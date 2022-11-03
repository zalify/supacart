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
  // const { acceptedCookies, onAcceptCookies } = useAcceptCookies()

  const { locale = 'en-US' } = useRouter()
  const navBarlinks = categories.slice(0, 2).map((c) => ({
    label: c.name,
    href: `/search/${c.slug}`,
  }))

  return (
    <CommerceProvider locale={locale}>
      <div className="h-full relative bg-primary mx-auto transition-colors duration-150 max-w-[2460px] pb-[295px]">
        <Navbar links={navBarlinks} />
        <GroupDisplay />
        <SyncCarts />
        <main className="fit">{children}</main>
        <Footer pages={pageProps.pages} />
        <ModalUI />
        <CheckoutProvider>
          <SidebarUI links={navBarlinks} />
        </CheckoutProvider>
        <Toaster />
        {/* <FeatureBar
          title="This site uses cookies to improve your experience. By clicking, you agree to our Privacy Policy."
          hide={acceptedCookies}
          action={
            <Button className="mx-5" onClick={() => onAcceptCookies()}>
              Accept cookies
            </Button>
          }
        /> */}
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

  // fixme: why we need to poll
  const isCheckout = gm?.isCheckout()
  useEffect(() => {
    if (!gm) return
    let timer: NodeJS.Timeout
    const loop = async () => {
      if (isCheckout) {
        if (data?.completedAt) {
          // make completed
          await gm.complete()
          gm.reset()
        } else {
          timer = setTimeout(async () => {
            await cartRefetch()
            loop()
          }, 10000)
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

import toast, { Toaster } from 'react-hot-toast'
import { Text } from '@components/ui'

const GroupDisplay = observer(() => {
  const { gm, setGm } = useGroupManager()
  const { data, mutate } = useCart()
  const cartRefetch = useRefState(mutate)
  const router = useRouter()
  const { addProductItem } = useShopifyCart()
  const [email, setEmail] = useState('')
  const cookie = getCartCookie()!
  const [loading, setLoading] = useState(false)
  const { query } = router
  const onOpen = async () => {
    if (!email) {
      toast.error('昵称不能为空', { position: 'bottom-center' })
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
      toast.error('昵称不能为空', { position: 'bottom-center' })
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
    const url = location.search.startsWith('?')
      ? location.href + `&g=${encodeURIComponent(gm!.groupId)}`
      : location.href + `?g=${encodeURIComponent(gm!.groupId)}`

    if ('share' in navigator) {
      navigator
        .share({
          title: `快来加入 ${gm?.getOwner?.nickname} 一起选购 DevJoy 的周边产品吧！`,
          url: url,
        })
        .then(() => {
          toast.success('邀请链接已复制！', { position: 'bottom-center' })
        })
        .catch(console.error)
    } else {
      copy(
        `快来加入 ${gm?.getOwner?.nickname} 一起选购 DevJoy 的周边产品吧！${url}`
      )
      toast.success('邀请链接已复制！', { position: 'bottom-center' })
    }
  }

  const onReset = () => {
    gm?.reset()
  }

  const onGoOldGroup = () => {
    router.replace({
      query: {
        g: gm!.groupId,
      },
    })
  }

  const onGoNewGroup = async () => {
    const newGid = typeof query.g === 'string' ? query.g : null
    const currentMember = gm?.groupData?.members.find(
      (m) => m.uuid === gm.userId
    )
    const currentName = currentMember ? currentMember.nickname : null

    if (newGid) {
      // gm?.reset()
      if (currentName) {
        // join new group with current Name
        setLoading(true)

        try {
          console.log('join ', newGid, currentName)

          const groupData = await GroupManager.joinGroup(
            newGid as string,
            currentName,
            {
              items: [],
            }
          )

          await cartRefetch.current()
          const gm = new GroupManager(groupData.id)
          gm.send(`change-group-${gm.groupId}`, groupData)
          setGm(gm)
          console.log('joined , ', gm.groupId)
        } catch (error) {
        } finally {
          setLoading(false)
        }
      }

      router.replace({
        query: {
          g: newGid,
        },
      })
    }
  }

  const isJoined = gm?.currentMember

  // if (gm?.hasGroup() && !gm?.isInCart())
  //   return (
  // <div className="fixed bottom-0 bg-primary z-50 w-full left-0 p-3 border-t border-slate-300">
  //   <Text className=""> </Text>在等待团长支付「拼单」</h6>
  //   <Button  className="w-full mt-4" onClick={onReset}>
  //     结束「拼单」并重新发起
  //   </Button>
  // </div>
  //   )

  // if (gm?.inited !== true) return null

  if (query.g && gm?.groupId && query.g !== gm.groupId) {
    return (
      <div className="fixed inset-0 backdrop-blur-sm bg-black/40 text-primary z-50 p-3">
        <div className="flex items-center justify-center h-full">
          <div className="w-[250px] bg-primary text-primary p-4 border-2 border-lime-400 rounded shadow-[0.5rem_-0.5rem_#d9f99d]">
            <Text variant="cardHeading">
              你当前和 {gm.getOwner?.nickname}{' '}
              的拼单还在进行中，看上去又点击了一个新的拼单链接
            </Text>

            <Button
              variant="slim"
              className="w-full mt-4"
              onClick={onGoOldGroup}
            >
              回到 {gm.getOwner?.nickname} 的拼单
            </Button>
            <Text variant="body" className="mt-4 !text-sm text-center">
              或者
            </Text>
            <Button
              variant="slim"
              className="w-full mt-4"
              onClick={onGoNewGroup}
            >
              加入新的拼单
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (gm?.hasGroup()) {
    if (gm?.isCheckout()) {
      return (
        <div className="fixed bottom-0 bg-primary z-50 w-full left-0 p-3 border-t border-slate-300">
          <Text variant="cardHeading">团长正在结账中</Text>
          <Text variant="body" className="mt-2 !text-sm">
            你可以关闭此页面或以团长的身份重新发起「拼单」
          </Text>

          <Button className="w-full mt-4" onClick={onReset}>
            重新发起「拼单」
          </Button>
        </div>
      )
    } else if (gm?.isInCart()) {
      return (
        <div className="fixed bottom-0 bg-primary z-50 w-full left-0 p-3 border-t border-slate-300">
          <Text variant="cardHeading">「拼单」进行中</Text>
          <div className="flex space-x-1">
            <div>成员：</div>
            {gm.groupData?.members.map((m) => (
              <div key={m.uuid} className="flex flex-col items-center">
                <div className="text-secondary capitalize rounded-full bg-secondary text-sm px-2 py-0.5">
                  {m.nickname}
                  {m.role === 'Owner' ? ' - 团长' : ''}
                </div>
              </div>
            ))}
          </div>
          <Button className="w-full mt-4" onClick={onShare}>
            邀请更多好友参与「拼单」
          </Button>
        </div>
      )
    } else {
      return (
        <div className="fixed bottom-0 bg-primary z-50 w-full left-0 p-3 border-t border-slate-300">
          <Button className="w-full mt-4" onClick={onReset}>
            重置
          </Button>
        </div>
      )
    }
  }

  if (query.g && !isJoined)
    return (
      <div className="fixed bottom-0 bg-primary z-50 w-full left-0 p-3 border-t border-slate-300">
        <div className="flex items-center justify-between mb-4">
          <Text variant="cardHeading" className="!mb-0">
            {gm?.getOwner?.nickname} 邀请你加入「拼单」
          </Text>
          <Button variant="slim" onClick={onReset} loading={loading}>
            自己逛逛
          </Button>
        </div>

        <div className="mt-3 p-2 text-sm border-2 border-lime-400 rounded shadow-[0.5rem_-0.5rem_#d9f99d]">
          你将作为成员加入{gm?.getOwner?.nickname}的「拼单」一起选购 DevJoy
          的周边产品，完成选购后即可关闭此页面，由团长 {gm?.getOwner?.nickname}{' '}
          完成结账。
        </div>

        <div>
          <input
            className="form-input w-full mt-4"
            placeholder="你的昵称"
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="mt-4 flex space-x-4">
          <Button className="w-full" onClick={onJoin} loading={loading}>
            加入
          </Button>
        </div>
      </div>
    )

  return (
    <div className="fixed bottom-0 bg-primary z-50 w-full left-0 p-3 border-t border-slate-300">
      {/* <p style={{ whiteSpace: 'pre', height: 100, overflowY: 'auto' }}>
        {gm?.groupData && JSON.stringify(gm?.groupData, null, 2)}
      </p> */}
      <Text variant="cardHeading" className="">
        发起「拼单」
      </Text>

      <div className="mt-3 p-2 text-sm border-2 border-lime-400 rounded shadow-[0.5rem_-0.5rem_#d9f99d]">
        你作为团长发起拼单，邀请至少一位朋友👬一起选购 DevJoy
        的周边产品，最终由团长独自完成下单即可。
      </div>

      {/* <p>
        <Button onClick={onReset}>Reset to new</Button>
      </p> */}
      {/* <div>
        
        {gm?.isCheckout() && (
          <span style={{ color: 'red', fontSize: 30 }}>group has checkout</span>
        )}
        {gm?.isComplete() && (
          <span style={{ color: 'red', fontSize: 30 }}>group has complete</span>
        )}
      </div> */}

      <div>
        <div>
          <input
            className="form-input w-full mt-4"
            placeholder="你的昵称"
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="flex space-x-4">
          <Button
            variant="ghost"
            className="w-full mt-4"
            onClick={onOpen}
            loading={loading}
          >
            先独自逛逛
          </Button>
          <Button className="w-full mt-4" onClick={onOpen} loading={loading}>
            发起「拼单」
          </Button>
        </div>
      </div>
    </div>
  )
})

export default Layout
