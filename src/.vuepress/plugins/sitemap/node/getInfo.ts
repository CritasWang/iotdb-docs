import type { GitData } from '@vuepress/plugin-git'
import type { App, Page } from 'vuepress/core'
import { removeLeadingSlash } from 'vuepress/shared'
import type {
  SitemapImageOption,
  SitemapLinkOption,
  SitemapNewsOption,
  SitemapPluginFrontmatter,
  SitemapPluginOptions,
  SitemapVideoOption,
} from '../typings/index.js'
import { logger } from './logger.js'

import { getDocVersion } from '../../../utils/getDocVersion.js'

const reportedLocales: string[] = []

const stripLocalePrefix = ({ path, pathLocale }: Page): string =>
  path.replace(pathLocale, '/')

/**
 * @returns A map with keys of rootPath and string[] value for pathLocales
 */
const getPagesLocaleMap = (app: App): Map<string, string[]> =>
  app.pages.reduce((map, page) => {
    const rootPath = stripLocalePrefix(page)
    const pathLocales = map.get(rootPath) ?? []

    pathLocales.push(page.pathLocale)

    return map.set(rootPath, pathLocales)
  }, new Map<string, string[]>())

/**
 * when version is latest, priority is 1.0
 * when version is not latest, case version startWith V2, priority is 0.9 , case version startWith V1 priority is 0.7, case version startWith V0 priority is 0.3
 * default priority is 0.5
 * @param path 
 */
const clacPriority = (path: string): number => {
  if(!path) return 0.5;
  const version = getDocVersion(path);
  if(version === 'latest') return 1.0;
  if(version.startsWith('V2.1.0')) return 0.9;
  if(version.startsWith('V1')) return 0.7;
  if(version.startsWith('V0')) return 0.3;
  return 0.5;
}

export interface SitemapInfo {
  lastmod?: string
  changefreq?: string
  priority?: number
  img?: SitemapImageOption[]
  video?: SitemapVideoOption[]
  links?: SitemapLinkOption[]
  news?: SitemapNewsOption[]
}

export const getSitemapInfos = (
  app: App,
  options: SitemapPluginOptions,
): [path: string, info: SitemapInfo][] => {
  const {
    changefreq = 'daily',
    excludePaths = ['/404.html'],
    modifyTimeGetter = (page: Page<{ git?: GitData }>): string =>
      page.data.git?.updatedTime
        ? new Date(page.data.git.updatedTime).toISOString()
        : '',
  } = options
  const { base, locales } = app.siteData

  const pageLocalesMap = getPagesLocaleMap(app)

  const sitemapInfos: [path: string, info: SitemapInfo][] = []

  app.pages.forEach(
    (
      page: Page<
        Record<string, unknown> & { git?: GitData },
        SitemapPluginFrontmatter
      >,
    ) => {
      const pageOptions = page.frontmatter.sitemap

      if (pageOptions === false) return

      const metaRobotTags = (page.frontmatter.head ?? []).find(
        (head) => head[1].name === 'robots',
      )

      if (
        // meta tags do not allow index
        ((metaRobotTags?.[1].content as string) || '')
          .split(/,/u)
          .map((content) => content.trim())
          .includes('noindex') ||
        // exclude in plugin options
        excludePaths.includes(page.path)
      )
        return

      const lastModifyTime = modifyTimeGetter(page, app)
      const priority = pageOptions?.priority ?? clacPriority(page.path);
      const rootPath = stripLocalePrefix(page)
      const relatedLocales = pageLocalesMap.get(rootPath)!

      let links: SitemapLinkOption[] = []

      if (relatedLocales.length > 1) {
        // warnings for missing `locale[path].lang` in debug mode
        if (app.env.isDebug)
          relatedLocales.forEach((localePrefix) => {
            if (
              !locales[localePrefix].lang &&
              !reportedLocales.includes(localePrefix)
            ) {
              logger.warn(`"lang" option for ${localePrefix} is missing`)
              reportedLocales.push(localePrefix)
            }
          })

        links = relatedLocales.map((localePrefix) => ({
           
          lang: locales[localePrefix]?.lang ?? 'en',
          url: `${base}${removeLeadingSlash(localePrefix)}${rootPath.substring(1)}`,
        }))
      }

      const sitemapInfo: SitemapInfo = {
        changefreq,
        links,
        ...(lastModifyTime ? { lastmod: lastModifyTime } : {}),
        ...pageOptions,
        priority,
      }

      // log sitemap info in debug mode
      if (app.env.isDebug)
        logger.info(
          `sitemap option for ${page.path}: ${JSON.stringify(
            sitemapInfo,
            null,
            2,
          )}`,
        )

      sitemapInfos.push([page.path, sitemapInfo])
    },
  )

  return sitemapInfos
}