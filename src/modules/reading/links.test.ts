import { describe, expect, it } from 'vitest'
import { hostOf, normalizeUrl, parseLink } from './links'

describe('saved links', () => {
  it('adds https to a bare address and keeps full ones', () => {
    expect(normalizeUrl('exemplo.com/artigo')).toBe('https://exemplo.com/artigo')
    expect(normalizeUrl('http://a.b/c')).toBe('http://a.b/c')
  })

  it('separates the address from a title typed around it', () => {
    expect(parseLink('Bom artigo https://site.com/x')).toEqual({ url: 'https://site.com/x', title: 'Bom artigo' })
    expect(parseLink('site.com.br/post sobre café')).toEqual({ url: 'https://site.com.br/post', title: 'sobre café' })
    expect(parseLink('https://site.com')).toEqual({ url: 'https://site.com', title: '' })
  })

  it('shows the host without www', () => {
    expect(hostOf('https://www.site.com/a')).toBe('site.com')
  })
})
