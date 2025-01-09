import { removeLeadingSlash } from 'vuepress/shared'
import { fs } from 'vuepress/utils'
import type { SitemapPluginOptions } from '../typings/index.js'
import { getDirname, path } from 'vuepress/utils';
const dirname = getDirname(import.meta.url);

const DEFAULT_TEMPLATE_PATH = path.resolve(
  dirname,
  '../templates/sitemap.xsl',
)

export const getSiteMapTemplate = (
  options: SitemapPluginOptions,
): [path: string, content: string] => [
  options.sitemapXSLFilename
    ? removeLeadingSlash(options.sitemapXSLFilename)
    : 'sitemap.xsl',
  options.sitemapXSLTemplate ?? fs.readFileSync(DEFAULT_TEMPLATE_PATH, 'utf-8'),
]
