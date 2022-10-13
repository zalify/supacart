import { GroupManager } from '@lib/GroupManager/server'
import { NextApiRequest, NextApiResponse } from 'next'

export const config = {
  api: {},
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { groupId } = req.query

  const group = await GroupManager.getGroup(groupId as string)

  res.status(200).json({ data: group })
}
