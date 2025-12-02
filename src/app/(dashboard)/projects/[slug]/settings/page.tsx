'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Save,
  Loader2,
  UserPlus,
  Trash2,
  Users,
  Settings,
  X,
  Crown,
  UserCog,
  User,
  Globe,
  Instagram,
  Youtube,
  Linkedin,
  Facebook,
  Image,
  Link2,
} from 'lucide-react'

interface Member {
  id: string
  userId: string
  role: 'OWNER' | 'CONSULTANT' | 'CLIENT'
  user: {
    id: string
    name: string
    email: string
    avatar: string | null
  }
}

interface SocialLinks {
  instagram?: string
  youtube?: string
  facebook?: string
  linkedin?: string
  twitter?: string
}

interface Project {
  id: string
  name: string
  slug: string
  description: string | null
  logo: string | null
  coverImage: string | null
  websiteUrl: string | null
  mondayBoardUrl: string | null
  socialLinks: SocialLinks | null
  aiContext: string | null
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED'
  members: Member[]
}

interface AvailableUser {
  id: string
  name: string
  email: string
  role: string
}

export default function ProjectSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [logo, setLogo] = useState('')
  const [coverImage, setCoverImage] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [mondayBoardUrl, setMondayBoardUrl] = useState('')
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({})
  const [aiContext, setAiContext] = useState('')
  const [status, setStatus] = useState<'ACTIVE' | 'PAUSED' | 'ARCHIVED'>('ACTIVE')

  // Members state
  const [showAddMember, setShowAddMember] = useState(false)
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRole, setSelectedRole] = useState<'CONSULTANT' | 'CLIENT'>('CLIENT')
  const [addingMember, setAddingMember] = useState(false)
  const [removingMember, setRemovingMember] = useState<string | null>(null)

  useEffect(() => {
    fetchProject()
  }, [slug])

  const fetchProject = async () => {
    try {
      const res = await fetch(`/api/projects/${slug}`)
      if (!res.ok) throw new Error('Error al cargar el proyecto')
      const data = await res.json()
      setProject(data)
      setName(data.name)
      setDescription(data.description || '')
      setLogo(data.logo || '')
      setCoverImage(data.coverImage || '')
      setWebsiteUrl(data.websiteUrl || '')
      setMondayBoardUrl(data.mondayBoardUrl || '')
      setSocialLinks(data.socialLinks || {})
      setAiContext(data.aiContext || '')
      setStatus(data.status)
    } catch {
      setError('Error al cargar el proyecto')
    } finally {
      setLoading(false)
    }
  }

  const fetchAvailableUsers = async () => {
    try {
      const res = await fetch('/api/users')
      if (!res.ok) throw new Error('Error al cargar usuarios')
      const data = await res.json()
      // Filtrar usuarios que ya son miembros
      const memberIds = project?.members.map((m) => m.userId) || []
      setAvailableUsers(data.filter((u: AvailableUser) => !memberIds.includes(u.id)))
    } catch (err) {
      console.error('Error fetching users:', err)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/projects/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          logo: logo || null,
          coverImage: coverImage || null,
          websiteUrl: websiteUrl || null,
          mondayBoardUrl: mondayBoardUrl || null,
          socialLinks,
          aiContext,
          status,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al guardar')
      }

      const updated = await res.json()
      // Si cambió el slug, redirigir
      if (updated.slug !== slug) {
        router.push(`/projects/${updated.slug}/settings`)
      } else {
        fetchProject()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleAddMember = async () => {
    if (!selectedUserId) return

    setAddingMember(true)
    try {
      const res = await fetch(`/api/projects/${slug}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          role: selectedRole,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al añadir miembro')
      }

      setShowAddMember(false)
      setSelectedUserId('')
      setSelectedRole('CLIENT')
      fetchProject()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al añadir miembro')
    } finally {
      setAddingMember(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('¿Eliminar este miembro del proyecto?')) return

    setRemovingMember(memberId)
    try {
      const res = await fetch(`/api/projects/${slug}/members/${memberId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al eliminar miembro')
      }

      fetchProject()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar miembro')
    } finally {
      setRemovingMember(null)
    }
  }

  const handleChangeMemberRole = async (memberId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/projects/${slug}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al cambiar rol')
      }

      fetchProject()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al cambiar rol')
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'OWNER':
        return <Crown className="w-4 h-4 text-yellow-500" />
      case 'CONSULTANT':
        return <UserCog className="w-4 h-4 text-blue-500" />
      default:
        return <User className="w-4 h-4 text-gray-500" />
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'Propietario'
      case 'CONSULTANT':
        return 'Consultor'
      case 'CLIENT':
        return 'Cliente'
      default:
        return role
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Proyecto no encontrado</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        href={`/projects/${slug}`}
        className="inline-flex items-center gap-2 text-gray-500 hover:text-primary mb-6 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver al proyecto
      </Link>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Settings className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-dark">Configuracion del proyecto</h1>
              <p className="text-sm text-gray-500">Gestiona los detalles y miembros del proyecto</p>
            </div>
          </div>
        </div>

        {/* Formulario de datos del proyecto */}
        <div className="p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-dark mb-4">Informacion general</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del proyecto *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripcion
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Breve descripcion del proyecto..."
                />
              </div>

              {/* Imagenes */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Image className="w-4 h-4 inline mr-1" />
                    URL del logotipo
                  </label>
                  <input
                    type="url"
                    value={logo}
                    onChange={(e) => setLogo(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="https://ejemplo.com/logo.png"
                  />
                  {logo && (
                    <div className="mt-2 w-16 h-16 rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={logo} alt="Logo preview" className="w-full h-full object-contain" />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Image className="w-4 h-4 inline mr-1" />
                    URL de imagen de portada
                  </label>
                  <input
                    type="url"
                    value={coverImage}
                    onChange={(e) => setCoverImage(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="https://ejemplo.com/cover.jpg"
                  />
                  {coverImage && (
                    <div className="mt-2 w-full h-20 rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={coverImage} alt="Cover preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>

              {/* URLs */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Globe className="w-4 h-4 inline mr-1" />
                    URL del sitio web
                  </label>
                  <input
                    type="url"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="https://ejemplo.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Link2 className="w-4 h-4 inline mr-1" />
                    URL de Monday
                  </label>
                  <input
                    type="url"
                    value={mondayBoardUrl}
                    onChange={(e) => setMondayBoardUrl(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="https://monday.com/boards/..."
                  />
                </div>
              </div>

              {/* Redes sociales */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Redes sociales
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Instagram className="w-5 h-5 text-pink-500 shrink-0" />
                    <input
                      type="url"
                      value={socialLinks.instagram || ''}
                      onChange={(e) => setSocialLinks({ ...socialLinks, instagram: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="https://instagram.com/..."
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Youtube className="w-5 h-5 text-red-500 shrink-0" />
                    <input
                      type="url"
                      value={socialLinks.youtube || ''}
                      onChange={(e) => setSocialLinks({ ...socialLinks, youtube: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="https://youtube.com/..."
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Facebook className="w-5 h-5 text-blue-600 shrink-0" />
                    <input
                      type="url"
                      value={socialLinks.facebook || ''}
                      onChange={(e) => setSocialLinks({ ...socialLinks, facebook: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="https://facebook.com/..."
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Linkedin className="w-5 h-5 text-blue-700 shrink-0" />
                    <input
                      type="url"
                      value={socialLinks.linkedin || ''}
                      onChange={(e) => setSocialLinks({ ...socialLinks, linkedin: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="https://linkedin.com/..."
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contexto para la IA
                </label>
                <textarea
                  value={aiContext}
                  onChange={(e) => setAiContext(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Describe el negocio, publico objetivo, productos/servicios, objetivos, etc. Esta informacion ayudara a la IA a generar mejores informes."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Esta informacion se usara como contexto para la generacion de informes con IA.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estado
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as typeof status)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="ACTIVE">Activo</option>
                  <option value="PAUSED">Pausado</option>
                  <option value="ARCHIVED">Archivado</option>
                </select>
              </div>
            </div>

            {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

            <div className="mt-6">
              <button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar cambios
              </button>
            </div>
          </div>
        </div>

        {/* Seccion de miembros */}
        <div className="p-6 border-t border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-gray-500" />
              <h2 className="text-lg font-semibold text-dark">Miembros del proyecto</h2>
            </div>
            <button
              onClick={() => {
                setShowAddMember(true)
                fetchAvailableUsers()
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary-600 transition text-sm"
            >
              <UserPlus className="w-4 h-4" />
              Añadir miembro
            </button>
          </div>

          <div className="space-y-2">
            {project.members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-medium">
                    {member.user.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <p className="font-medium text-dark">{member.user.name}</p>
                    <p className="text-sm text-gray-500">{member.user.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {getRoleIcon(member.role)}
                    {member.role === 'OWNER' ? (
                      <span className="text-sm text-gray-600">{getRoleLabel(member.role)}</span>
                    ) : (
                      <select
                        value={member.role}
                        onChange={(e) => handleChangeMemberRole(member.id, e.target.value)}
                        className="text-sm border border-gray-300 rounded px-2 py-1"
                      >
                        <option value="CONSULTANT">Consultor</option>
                        <option value="CLIENT">Cliente</option>
                      </select>
                    )}
                  </div>

                  {member.role !== 'OWNER' && (
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      disabled={removingMember === member.id}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded transition disabled:opacity-50"
                    >
                      {removingMember === member.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal añadir miembro */}
      {showAddMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-dark">Añadir miembro</h2>
              <button
                onClick={() => setShowAddMember(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Usuario
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">Selecciona un usuario</option>
                  {availableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rol en el proyecto
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as typeof selectedRole)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="CONSULTANT">Consultor (puede editar)</option>
                  <option value="CLIENT">Cliente (solo lectura)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddMember(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddMember}
                disabled={addingMember || !selectedUserId}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition disabled:opacity-50 flex items-center gap-2"
              >
                {addingMember && <Loader2 className="w-4 h-4 animate-spin" />}
                <UserPlus className="w-4 h-4" />
                Añadir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
