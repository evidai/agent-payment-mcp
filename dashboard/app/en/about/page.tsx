/**
 * /en/about — English /about LP。
 *
 * 実体は /about/en/page.tsx に置いたまま、こちらは re-export だけ。
 * これで「middleware 経由で /en/about に飛ばされた非 JP IP」が
 * もう 1 段 redirect を経由せず、直接 HTML を受け取れる。
 */

export { default, metadata } from "../../about/en/page";
