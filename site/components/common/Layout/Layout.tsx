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
import { useEffect, useMemo, useState } from 'react'

import { useGroupManager } from '@components/GroupManagerProvider'
import { useRefState } from '@lib/hooks/useRefState'
import { GroupManager } from '@lib/GroupManager/client'
import { getCartCookie } from '@lib/getCartCookie'
import { observer } from 'mobx-react'
import { Group } from 'types/Customer'
import { toJS } from 'mobx'
import { copy } from '@lib/clipboard'
import useCart from '@framework/cart/use-cart'
import { useShopifyCart } from '@lib/hooks/useShopifyCart'
import { debounce, delay } from 'lodash'

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
      <div className={cn(s.root)}>
        <Navbar links={navBarlinks} />
        <GroupDisplay />
        <SyncCarts />
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

const SyncCarts = observer(() => {
  const { data, isLoading, isEmpty, mutate } = useCart()

  const cartData = useRefState(data)
  const { gm } = useGroupManager()

  const cartRefetch = useMemo(
    () =>
      debounce(() => {
        mutate()
        delay(mutate, 300)
      }, 100),
    [mutate]
  )

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

      cartRefetch()
    }
    gm.on(`change-product-${gm.groupId}`, handler)

    return () => {
      gm.off(`change-product-${gm.groupId}`, handler)
    }
  }, [cartData, cartRefetch, gm])

  useEffect(() => {
    if (!gm) return
    const handler = (group: Group) => {
      gm.setGroup(group)
      cartRefetch()
    }
    gm.on(`change-group-${gm.groupId}`, handler)

    return () => {
      gm.off(`change-group-${gm.groupId}`, handler)
    }
  }, [cartRefetch, gm])

  const isCheckout = gm?.isCheckout()
  useEffect(() => {
    if (!gm) return
    let timer: NodeJS.Timeout
    const loop = async () => {
      if (isCheckout) {
        if (data?.completedAt) {
          // make completed
          await gm.complete()
        } else {
          timer = setTimeout(async () => {
            await cartRefetch()
            loop()
          }, 1000)
        }
      }
    }
    loop()
    return () => {
      if (timer) {
        clearTimeout(timer)
      }
    }
  }, [cartRefetch, data, gm, isCheckout])

  return <></>
})

const GroupDisplay = observer(() => {
  const { gm, setGm } = useGroupManager()
  const { data, mutate } = useCart()
  const cartRefetch = useRefState(mutate)
  const { query } = useRouter()
  const { addProductItem } = useShopifyCart()
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
        cartData = await addProductItem({
          quantity: 0,
          variantId: '', // 没有 variantId && quantity =0 只会创建 checkout
        })
      }
      const cartId = cartData!.id
      const products =
        data?.lineItems.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
        })) || []

      const group = await GroupManager.openGroup(cartId, email, {
        items: products,
      })

      setGm(new GroupManager(group.id))
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
      console.log('join ', query.g)

      const groupData = await GroupManager.joinGroup(query.g as string, email, {
        items: [],
      })

      await cartRefetch.current()
      const gm = new GroupManager(groupData.id)
      gm.send(`change-group-${gm.groupId}`, groupData)
      setGm(gm)
    } catch (error) {
    } finally {
      setLoading(false)
    }
  }
  const onShare = () => {
    copy(
      location.search.startsWith('?')
        ? location.href + `&g=${encodeURIComponent(gm!.groupId)}`
        : location.href + `?g=${encodeURIComponent(gm!.groupId)}`
    )
  }

  const onRest = () => {
    gm?.reset()
  }

  const isSameGroup = gm?.currentMember

  return (
    <div>
      <p style={{ whiteSpace: 'pre', height: 300, overflowY: 'auto' }}>
        {gm?.groupData && JSON.stringify(gm?.groupData, null, 2)}
      </p>
      <p>
        <Button onClick={onRest}>Reset to new</Button>
      </p>
      <div>
        {gm?.isInCart() && !isSameGroup && (
          <Button onClick={onJoin} loading={loading}>
            {'Join group'}
          </Button>
        )}
        {gm?.isCheckout() && (
          <span style={{ color: 'red', fontSize: 30 }}>group has checkout</span>
        )}
        {gm?.isComplete() && (
          <span style={{ color: 'red', fontSize: 30 }}>group has complete</span>
        )}
      </div>
      {query.groupId && !isSameGroup && (
        <div>
          <p>
            <input
              style={{ border: '1px solid #ccc' }}
              type="email"
              onChange={(e) => setEmail(e.target.value)}
            />
          </p>
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
