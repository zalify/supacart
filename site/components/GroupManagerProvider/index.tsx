import { GroupManager } from '@lib/GroupManager/client'
import { useRouter } from 'next/router'
import React, { useContext, useEffect, useState } from 'react'

export const GroupManagerContext = React.createContext<{
  gm: GroupManager | null
  setGm: React.Dispatch<React.SetStateAction<GroupManager | null>>
}>({ gm: null, setGm: () => {} })

export const GroupManagerProvider: React.FC<{
  children: React.ReactNode
}> = (props) => {
  const { query } = useRouter()

  const groupId = (query.g as string) || GroupManager.getGroupId()
  const [gm, setGm] = useState<GroupManager | null>(null)

  useEffect(() => {
    if (groupId) {
      const newGm = new GroupManager(groupId)
      setGm(newGm)
      return () => {
        newGm.destroy()
      }
    } else {
      setGm(null)
    }
  }, [groupId])

  return (
    <GroupManagerContext.Provider
      key={gm?.groupId || ''}
      value={{
        gm,
        setGm,
      }}
    >
      {props.children}
    </GroupManagerContext.Provider>
  )
}

export const useGroupManager = () => {
  return useContext(GroupManagerContext)
}
