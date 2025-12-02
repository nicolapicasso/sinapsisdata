'use client'

import { signOut } from 'next-auth/react'
import { LogOut, ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

interface HeaderProps {
  user: {
    name: string
    email: string
    role: string
    avatar?: string
  }
}

export function Header({ user }: HeaderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Admin</span>
      case 'CONSULTANT':
        return <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Consultor</span>
      default:
        return <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">Cliente</span>
    }
  }

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-end px-6">
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-3 hover:bg-gray-50 rounded-lg px-3 py-2 transition"
        >
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-dark">{user.name}</p>
            <p className="text-xs text-gray-500">{user.email}</p>
          </div>
          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-medium">
            {user.avatar ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover" />
            ) : (
              user.name?.charAt(0).toUpperCase()
            )}
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="font-medium text-dark">{user.name}</p>
              <p className="text-sm text-gray-500">{user.email}</p>
              <div className="mt-2">{getRoleBadge(user.role)}</div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
            >
              <LogOut className="w-4 h-4" />
              Cerrar sesion
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
