import '@assets/main.css'
import '@assets/chrome-bug.css'
import 'keen-slider/keen-slider.min.css'

import { FC, ReactNode, useEffect } from 'react'
import type { AppProps } from 'next/app'
import { Head } from '@components/common'
import { ManagedUIContext } from '@components/ui/context'
import { GroupManagerProvider } from '@components/GroupManagerProvider'
import { store } from '@lib/store'

const Noop: FC<{ children?: ReactNode }> = ({ children }) => <>{children}</>

export default function MyApp({ Component, pageProps }: AppProps) {
  const Layout = (Component as any).Layout || Noop

  useEffect(() => {
    document.body.classList?.remove('loading')
  }, [])

  useEffect(() => {
    if ((pageProps as any)?.allProducts) {
      store.state.setProducts((pageProps as any)?.allProducts)
    }
  }, [pageProps])

  return (
    <>
      <Head />
      <style>{`nextjs-portal { display: none} body {overflow:auto !important}`}</style>
      <GroupManagerProvider>
        <ManagedUIContext>
          <Layout pageProps={pageProps}>
            <Component {...pageProps} />
          </Layout>
        </ManagedUIContext>
      </GroupManagerProvider>
    </>
  )
}
