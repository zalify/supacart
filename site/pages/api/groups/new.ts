import { GroupManager } from '@lib/GroupManager/server'
import { NextApiRequest, NextApiResponse } from 'next'

export const config = {
  api: {
    bodyParser: true,
  },
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { cartId, member } = req.body

  const group = await GroupManager.newGroup(cartId, member)

  res.status(200).json({ data: group })
}
