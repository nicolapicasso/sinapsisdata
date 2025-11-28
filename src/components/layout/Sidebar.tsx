'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarProps {
  userRole: string
}

export function Sidebar({ userRole }: SidebarProps) {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Persistir el estado en localStorage
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved !== null) {
      setIsCollapsed(saved === 'true')
    }
  }, [])

  const toggleCollapse = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem('sidebar-collapsed', String(newState))
  }

  const mainLinks = [
    {
      href: '/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      href: '/projects',
      label: 'Proyectos',
      icon: FolderKanban,
    },
  ]

  const adminLinks = [
    {
      href: '/admin/users',
      label: 'Usuarios',
      icon: Users,
    },
    {
      href: '/admin/projects',
      label: 'Gestionar Proyectos',
      icon: Settings,
    },
  ]

  return (
    <aside
      className={cn(
        "bg-white border-r border-gray-200 flex flex-col transition-all duration-300 shrink-0",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className={cn("p-4 flex items-center", isCollapsed ? "justify-center" : "px-6")}>
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">SD</span>
          </div>
          {!isCollapsed && (
            <span className="font-bold text-dark text-lg whitespace-nowrap">Sinapsis Data</span>
          )}
        </Link>
      </div>

      {/* Navegación */}
      <nav className={cn("flex-1 px-2", isCollapsed ? "px-2" : "px-4")}>
        <div className="space-y-1">
          {mainLinks.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(link.href + '/')
            return (
              <Link
                key={link.href}
                href={link.href}
                title={isCollapsed ? link.label : undefined}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isCollapsed && 'justify-center px-2',
                  isActive
                    ? 'bg-primary text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                <link.icon className="w-5 h-5 shrink-0" />
                {!isCollapsed && <span>{link.label}</span>}
              </Link>
            )
          })}
        </div>

        {userRole === 'ADMIN' && (
          <>
            {!isCollapsed && (
              <div className="mt-8 mb-2 px-3">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Administracion
                </span>
              </div>
            )}
            {isCollapsed && <div className="mt-6 border-t border-gray-200 pt-4" />}
            <div className="space-y-1">
              {adminLinks.map((link) => {
                const isActive = pathname === link.href
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    title={isCollapsed ? link.label : undefined}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      isCollapsed && 'justify-center px-2',
                      isActive
                        ? 'bg-primary text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    )}
                  >
                    <link.icon className="w-5 h-5 shrink-0" />
                    {!isCollapsed && <span>{link.label}</span>}
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </nav>

      {/* Botón de colapsar */}
      <div className={cn("p-4 border-t border-gray-200", isCollapsed && "px-2")}>
        <button
          onClick={toggleCollapse}
          className={cn(
            "flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg transition-colors",
            isCollapsed && "justify-center px-2"
          )}
          title={isCollapsed ? "Expandir menú" : "Colapsar menú"}
        >
          {isCollapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5" />
              <span>Colapsar</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
