import { SHOPIFY_CHECKOUT_ID_COOKIE } from '@framework/const'
import Cookies from 'js-cookie'

export function getCartCookie() {
  return Cookies.get(SHOPIFY_CHECKOUT_ID_COOKIE)
}
