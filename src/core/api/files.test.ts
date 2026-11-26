import { describe, expect, it } from 'vitest'
import { fileCategory, normalizeUrl, parseLink, urlHost } from './files'

describe('links', () => {
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
    expect(urlHost('https://www.site.com/a')).toBe('site.com')
  })
})

describe('file categories', () => {
  it('reads the type first and the extension when the type is missing', () => {
    expect(fileCategory({ type: 'audio/mpeg', name: 'x' })).toBe('audio')
    expect(fileCategory({ type: '', name: 'Filme.MKV' })).toBe('video')
    expect(fileCategory({ type: 'application/pdf', name: 'laudo' })).toBe('document')
    expect(fileCategory({ type: '', name: 'foto.heic' })).toBe('image')
    expect(fileCategory({ type: 'application/zip', name: 'a.zip' })).toBe('other')
  })
})
