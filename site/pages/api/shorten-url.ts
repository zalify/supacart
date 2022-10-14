import { GroupManager } from '@lib/GroupManager/server'
import { redis } from '@lib/redis'
import { nanoid } from 'nanoid'
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
  const { cartId } = req.body

  const shortenId = nanoid(8)
  if (!(await redis.get(shortenId))) {
    await redis.set(shortenId, cartId)
  }

  res.status(200).json({ data: nanoid })
}
