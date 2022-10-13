import { GroupManager } from '@lib/GroupManager/client'
import React, { useContext, useEffect, useState } from 'react'

export const GroupManagerContext = React.createContext<{
  gm: GroupManager | null
  setGm: React.Dispatch<React.SetStateAction<GroupManager | null>>
}>({ gm: null, setGm: () => {} })

export const GroupManagerProvider: React.FC<{
  groupId?: string | null
  children: React.ReactNode
}> = (props) => {
  const [gm, setGm] = useState<GroupManager | null>(null)

  useEffect(() => {
    if (props.groupId) {
      const newGm = new GroupManager(props.groupId)
      setGm(newGm)
      return () => {
        newGm.destroy()
      }
    } else {
      setGm(null)
    }
  }, [props.groupId])

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
