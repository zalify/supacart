import cn from 'clsx'
import s from './Layout.module.css'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { CommerceProvider } from '@framework'
import LoginView from '@components/auth/LoginView'
import { useUI } from '@components/ui/context'
import { Navbar, Footer } from '@components/common'
import ShippingView from '@components/checkout/ShippingView'
import CartSidebarView from '@components/cart/CartSidebarView'
import { useAcceptCookies } from '@lib/hooks/useAcceptCookies'
import { Sidebar, Button, LoadingDots } from '@components/ui'
import PaymentMethodView from '@components/checkout/PaymentMethodView'
import CheckoutSidebarView from '@components/checkout/CheckoutSidebarView'
import { CheckoutProvider } from '@components/checkout/context'
import { MenuSidebarView } from '@components/common/UserNav'
import type { Page } from '@commerce/types/page'
import type { Category } from '@commerce/types/site'
import type { Link as LinkProps } from '../UserNav/MenuSidebarView'
import { useEffect, useState } from 'react'

import { useGroupManager } from '@components/GroupManagerProvider'
import { useRefState } from '@lib/hooks/useRefState'
import useSWR, { SWRConfig, useSWRConfig } from 'swr'
import { GroupManager } from '@lib/GroupManager/client'
import { cartCookie, getCartCookie } from '@lib/getCartCookie'
import { observer } from 'mobx-react'
import { Group } from 'types/Customer'
import { toJS } from 'mobx'
import { copy } from '@lib/clipboard'
import useCart from '@framework/cart/use-cart'
import useAddItem from '@framework/cart/use-add-item'
import Cookies from 'js-cookie'

const Loading = () => (
  <div className="w-80 h-80 flex items-center text-center justify-center p-3">
    <LoadingDots />
  </div>
)

const dynamicProps = {
  loading: Loading,
}

const SignUpView = dynamic(() => import('@components/auth/SignUpView'), {
  ...dynamicProps,
})

const ForgotPassword = dynamic(
  () => import('@components/auth/ForgotPassword'),
  {
    ...dynamicProps,
  }
)

const FeatureBar = dynamic(() => import('@components/common/FeatureBar'), {
  ...dynamicProps,
})

const Modal = dynamic(() => import('@components/ui/Modal'), {
  ...dynamicProps,
  ssr: false,
})

interface Props {
  pageProps: {
    pages?: Page[]
    categories: Category[]
  }
  children?: React.ReactNode
}

const ModalView: React.FC<{ modalView: string; closeModal(): any }> = ({
  modalView,
  closeModal,
}) => {
  return (
    <Modal onClose={closeModal}>
      {modalView === 'LOGIN_VIEW' && <LoginView />}
      {modalView === 'SIGNUP_VIEW' && <SignUpView />}
      {modalView === 'FORGOT_VIEW' && <ForgotPassword />}
    </Modal>
  )
}

const ModalUI: React.FC = () => {
  const { displayModal, closeModal, modalView } = useUI()
  return displayModal ? (
    <ModalView modalView={modalView} closeModal={closeModal} />
  ) : null
}

const SidebarView: React.FC<{
  sidebarView: string
  closeSidebar(): any
  links: LinkProps[]
}> = ({ sidebarView, closeSidebar, links }) => {
  return (
    <Sidebar onClose={closeSidebar}>
      {sidebarView === 'CART_VIEW' && <CartSidebarView />}
      {sidebarView === 'SHIPPING_VIEW' && <ShippingView />}
      {sidebarView === 'PAYMENT_VIEW' && <PaymentMethodView />}
      {sidebarView === 'CHECKOUT_VIEW' && <CheckoutSidebarView />}
      {sidebarView === 'MOBILE_MENU_VIEW' && <MenuSidebarView links={links} />}
    </Sidebar>
  )
}

const SidebarUI: React.FC<{ links: LinkProps[] }> = ({ links }) => {
  const { displaySidebar, closeSidebar, sidebarView } = useUI()
  return displaySidebar ? (
    <SidebarView
      links={links}
      sidebarView={sidebarView}
      closeSidebar={closeSidebar}
    />
  ) : null
}

const Layout: React.FC<Props> = ({
  children,
  pageProps: { categories = [], ...pageProps },
}) => {
  const { acceptedCookies, onAcceptCookies } = useAcceptCookies()
  const { locale = 'en-US' } = useRouter()
  const navBarlinks = categories.slice(0, 2).map((c) => ({
    label: c.name,
    href: `/search/${c.slug}`,
  }))

  return (
    <CommerceProvider locale={locale}>
      <GroupDisplay />
      <SyncCarts />
      <div className={cn(s.root)}>
        <Navbar links={navBarlinks} />
        <main className="fit">{children}</main>
        <Footer pages={pageProps.pages} />
        <ModalUI />
        <CheckoutProvider>
          <SidebarUI links={navBarlinks} />
        </CheckoutProvider>

        <FeatureBar
          title="This site uses cookies to improve your experience. By clicking, you agree to our Privacy Policy."
          hide={acceptedCookies}
          action={
            <Button className="mx-5" onClick={() => onAcceptCookies()}>
              Accept cookies
            </Button>
          }
        />
      </div>
    </CommerceProvider>
  )
}

const SyncCarts = () => {
  const { data, isLoading, isEmpty, mutate } = useCart()

  const cartRefetch = useRefState(mutate)
  const cartData = useRefState(data)
  const { gm } = useGroupManager()

  useEffect(() => {
    if (!gm) return
    const handler = (payload: {
      type: 'add' | 'remove'
      userId: string
      variantId: string | number
    }) => {
      const member = gm.groupData?.members.find(
        (m) => m.uuid === payload.userId
      )

      const product = cartData.current?.lineItems.find(
        (item) => item.variantId === payload.variantId
      )

      if (member && product) {
        console.log(`${member.email} ${payload.type} ${product.name}`)
      }

      let timer = setTimeout(() => {
        // FIXME update cart 之后 ，马上获取 cart 的数据是有延迟的
        // 看看修改 useCart，直接改数据
        cartRefetch.current()
      }, 500)
      return () => {
        clearTimeout(timer)
      }
    }
    gm.on(`change-product-${gm.groupId}`, handler)

    return () => {
      gm.off(`change-product-${gm.groupId}`, handler)
    }
  }, [cartData, cartRefetch, gm])

  useEffect(() => {
    if (!gm) return
    const handler = (group: Group) => {
      console.log('change-group', group)

      gm.setGroup(group)
      setTimeout(() => {
        cartRefetch.current()
      }, 500)
    }
    gm.on(`change-group-${gm.groupId}`, handler)

    return () => {
      gm.off(`change-group-${gm.groupId}`, handler)
    }
  }, [cartRefetch, gm])

  return <></>
}

const GroupDisplay = observer(() => {
  const { gm, setGm } = useGroupManager()
  const { data, mutate } = useCart()
  const cartRefetch = useRefState(mutate)
  const { query } = useRouter()
  const addItem = useAddItem()
  const [email, setEmail] = useState('')
  const cookie = getCartCookie()!
  const [loading, setLoading] = useState(false)

  const onOpen = async () => {
    if (!email) {
      alert(`email 不能为空`)
      return
    }
    setLoading(true)
    try {
      let cartData = data

      if (!cookie) {
        cartData = await addItem({
          quantity: 0,
          variantId: '', // quantity =0 只会创建 checkout
        })
        Cookies.set(cartCookie, cartData.id)
      }
      const cartId = cartData!.id
      const products =
        data?.lineItems.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
        })) || []

      await GroupManager.openGroup(cartId, email, { items: products })
      setGm(new GroupManager(cartId))
    } catch (error) {
    } finally {
      setLoading(false)
    }
  }
  const onJoin = async () => {
    if (!email) {
      alert(`email 不能为空`)
      return
    }
    setLoading(true)
    try {
      const groupData = await GroupManager.joinGroup(
        query.groupId as string,
        email,
        { items: [] }
      )
      await cartRefetch.current()
      const gm = new GroupManager(query.groupId as any)
      gm.send(`change-group-${gm.groupId}`, {
        group: groupData,
      })
      setGm(gm)
    } catch (error) {
    } finally {
      setLoading(false)
    }
  }
  const onShare = () => {
    copy(
      location.search.startsWith('?')
        ? location.href + `&groupId=${encodeURIComponent(gm!.groupId)}`
        : location.href + `?groupId=${encodeURIComponent(gm!.groupId)}`
    )
  }

  const isSameGroup = query.groupId === cookie

  return (
    <div>
      <p style={{ whiteSpace: 'pre', height: 300, overflowY: 'auto' }}>
        {gm?.groupData && JSON.stringify(gm?.groupData, null, 2)}
      </p>
      {query.groupId && !isSameGroup && (
        <div>
          <p>
            <input
              style={{ border: '1px solid #ccc' }}
              type="email"
              onChange={(e) => setEmail(e.target.value)}
            />
          </p>

          <Button onClick={onJoin} loading={loading}>
            Join group
          </Button>
        </div>
      )}
      {gm?.hasGroup() ? (
        <div>
          <Button onClick={onShare}>Share</Button>
        </div>
      ) : (
        <div>
          <p>
            <input
              style={{ border: '1px solid #ccc' }}
              type="email"
              onChange={(e) => setEmail(e.target.value)}
            />
          </p>
          {
            <Button onClick={onOpen} loading={loading}>
              Open group
            </Button>
          }
        </div>
      )}
    </div>
  )
})

export default Layout
