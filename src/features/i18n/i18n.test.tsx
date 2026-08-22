// @vitest-environment jsdom
import {fireEvent,render,screen} from '@testing-library/react'
import {describe,expect,it} from 'vitest'
import {I18nProvider,LanguageSwitch,useI18n} from './i18n'
function Probe(){const{t}=useI18n();return <><span>{t('dashboard')}</span><input aria-label="draft" defaultValue="unfinished form"/><LanguageSwitch/></>}
describe('i18n',()=>{it('defaults to Chinese, persists English, and does not remount form state',()=>{localStorage.clear();render(<I18nProvider><Probe/></I18nProvider>);expect(screen.getByText('工作台')).toBeTruthy();const input=screen.getByLabelText('draft') as HTMLInputElement;fireEvent.change(input,{target:{value:'keep me'}});fireEvent.click(screen.getByText('English'));expect(screen.getByText('Workspace')).toBeTruthy();expect(input.value).toBe('keep me');expect(localStorage.getItem('contentos.language')).toBe('en')})})
