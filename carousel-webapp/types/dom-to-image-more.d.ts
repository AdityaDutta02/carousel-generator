declare module 'dom-to-image-more' {
  interface Options {
    scale?: number
    width?: number
    height?: number
    style?: Record<string, string>
    filter?: (node: Node) => boolean
    bgcolor?: string
    quality?: number
  }

  function toPng(node: Node, options?: Options): Promise<string>
  function toJpeg(node: Node, options?: Options): Promise<string>
  function toBlob(node: Node, options?: Options): Promise<Blob>
  function toSvg(node: Node, options?: Options): Promise<string>

  export default { toPng, toJpeg, toBlob, toSvg }
}
