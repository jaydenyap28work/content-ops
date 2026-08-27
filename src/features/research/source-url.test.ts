import {describe,expect,it} from 'vitest'
import {parseSourceInput} from './source-url'
describe('parseSourceInput',()=>{
 it('keeps an optional blank source empty',()=>expect(parseSourceInput('')).toEqual({url:null,platform:null}))
 it('extracts the first URL from Chinese share text',()=>expect(parseSourceInput('复制打开小红书 https://www.xiaohongshu.com/explore/abc 更多文字')).toEqual({url:'https://www.xiaohongshu.com/explore/abc',platform:'xhs'}))
 it('adds https and detects short-video platforms',()=>{expect(parseSourceInput('v.douyin.com/abc123')).toEqual({url:'https://v.douyin.com/abc123',platform:'douyin'});expect(parseSourceInput('tiktok.com/@lksoft/video/1').platform).toBe('tiktok')})
 it('returns no URL for ordinary text',()=>expect(parseSourceInput('这段分享文字没有链接')).toEqual({url:null,platform:null}))
})