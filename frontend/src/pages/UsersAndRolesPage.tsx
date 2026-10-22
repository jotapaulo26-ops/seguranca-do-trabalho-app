import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Role, User } from '../types';
import {
  Shield,
  Users,
  Plus,
  Edit,
  Trash2,
  Check,
  X,
  Lock,
  KeyRound,
  Smartphone,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

const MODULES_LIST = [
  { key: 'dashboard', name: 'Dashboard', actions: ['view'] },
  { key: 'employees', name: 'Funcionários & EPIs', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'map', name: 'Mapa de Riscos', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'documents', name: 'Documentos & APRs', actions: ['view', 'create', 'edit', 'delete', 'sign', 'approve'] },
  { key: 'users', name: 'Gestão de Usuários', actions: ['view', 'manage'] },
  { key: 'roles', name: 'Perfis de Acesso', actions: ['view', 'manage'] },
  { key: 'audit', name: 'Auditoria de Ações', actions: ['view'] },
  { key: 'settings', name: 'Configurações do Sistema', actions: ['view', 'manage'] }
];

const ACTION_LABELS: Record<string, string> = {
  view: 'Visualizar',
  create: 'Criar',
  edit: 'Editar',
  delete: 'Excluir',
  sign: 'Assinar Digitalmente',
  approve: 'Aprovar',
  manage: 'Gerenciar Completo'
};

export const UsersAndRolesPage: React.FC = () => {
  const { can } = useAuth();
  const [activeTab, setActiveTab] = useState<'roles' | 'users'>('roles');

  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states for Role
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({});

  // Modal states for User
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRoleId, setUserRoleId] = useState('');

  const loadData = async () => {
    try {
      const [rolesData, usersData] = await Promise.all([
        api.get<Role[]>('/roles'),
        api.get<User[]>('/users')
      ]);
      setRoles(rolesData);
      setUsers(usersData);
    } catch (err) {
      console.error('Erro ao carregar perfis e usuários:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // --- ROLE ACTIONS ---
  const openCreateRoleModal = () => {
    setEditingRole(null);
    setRoleName('');
    setRoleDescription('');
    setRolePermissions({
      dashboard: ['view'],
      employees: ['view'],
      map: ['view'],
      documents: ['view', 'sign']
    });
    setRoleModalOpen(true);
  };

  const openEditRoleModal = (role: Role) => {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleDescription(role.description || '');
    setRolePermissions(role.permissions || {});
    setRoleModalOpen(true);
  };

  const handleTogglePermission = (mod: string, action: string) => {
    const current = rolePermissions[mod] || [];
    let updated: string[];
    if (current.includes(action)) {
      updated = current.filter(a => a !== action);
    } else {
      updated = [...current, action];
    }
    setRolePermissions({
      ...rolePermissions,
      [mod]: updated
    });
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName.trim()) {
      alert('Informe o nome do perfil.');
      return;
    }

    try {
      if (editingRole) {
        await api.put(`/roles/${editingRole.id}`, {
          name: roleName.trim(),
          description: roleDescription,
          permissions: rolePermissions
        });
      } else {
        await api.post('/roles', {
          name: roleName.trim(),
          description: roleDescription,
          permissions: rolePermissions
        });
      }
      setRoleModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar perfil.');
    }
  };

  const handleDeleteRole = async (roleId: string, name: string) => {
    if (confirm(`Deseja realmente excluir o perfil "${name}"?`)) {
      try {
        await api.delete(`/roles/${roleId}`);
        loadData();
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  // --- USER ACTIONS ---
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName || !userEmail || !userPassword || !userRoleId) {
      alert('Preencha todos os campos para cadastrar o usuário.');
      return;
    }

    try {
      await api.post('/users', {
        name: userName.trim(),
        email: userEmail.trim(),
        password: userPassword,
        role_id: userRoleId
      });
      setUserModalOpen(false);
      setUserName('');
      setUserEmail('');
      setUserPassword('');
      setUserRoleId('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao cadastrar usuário.');
    }
  };

  const handleToggleUserActive = async (user: User) => {
    try {
      await api.put(`/users/${user.id}`, {
        active: user.active === 1 ? 0 : 1
      });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (confirm(`Deseja realmente excluir o usuário ${user.name}?`)) {
      try {
        await api.delete(`/users/${user.id}`);
        loadData();
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-500" />
            Controle de Perfis & Permissões Granulares
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Crie perfis personalizados e limite exatamente o que cada usuário pode visualizar ou editar
          </p>
        </div>

        {/* Action Button */}
        {activeTab === 'roles' ? (
          can('roles', 'manage') && (
            <button
              onClick={openCreateRoleModal}
              className="py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-md shadow-amber-500/20 transition-all hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4" />
              Novo Perfil Customizado
            </button>
          )
        ) : (
          can('users', 'manage') && (
            <button
              onClick={() => {
                setUserRoleId(roles[0]?.id || '');
                setUserModalOpen(true);
              }}
              className="py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-md shadow-amber-500/20 transition-all hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4" />
              Cadastrar Novo Usuário
            </button>
          )
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('roles')}
          className={`py-2 px-4 text-xs font-bold border-b-2 flex items-center gap-2 ${
            activeTab === 'roles'
              ? 'border-amber-500 text-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Perfis de Acesso ({roles.length})
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`py-2 px-4 text-xs font-bold border-b-2 flex items-center gap-2 ${
            activeTab === 'users'
              ? 'border-amber-500 text-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Users className="w-4 h-4" />
          Usuários do Sistema ({users.length})
        </button>
      </div>

      {/* TAB 1: ROLES */}
      {activeTab === 'roles' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roles.map(role => (
            <div
              key={role.id}
              className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-slate-900 text-base">{role.name}</h3>
                    {role.is_system === 1 && (
                      <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full">
                        Nativo
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {can('roles', 'manage') && (
                      <button
                        onClick={() => openEditRoleModal(role)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                        title="Editar Permissões"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                    {role.is_system === 0 && can('roles', 'manage') && (
                      <button
                        onClick={() => handleDeleteRole(role.id, role.name)}
                        className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                        title="Excluir Perfil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-500 mb-4">{role.description || 'Perfil sem descrição.'}</p>

                {/* Permissions summary */}
                <div className="space-y-1.5 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-1">
                    Permissões Ativas:
                  </span>
                  {Object.entries(role.permissions || {}).map(([mod, actions]) => (
                    <div key={mod} className="flex justify-between items-center text-[11px]">
                      <span className="font-semibold text-slate-700 capitalize">{mod}:</span>
                      <span className="text-slate-500 text-[10px]">
                        {actions.join(', ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: USERS */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="divide-y divide-slate-100">
            {users.map(u => (
              <div key={u.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-slate-900 text-amber-400 font-bold flex items-center justify-center text-sm shrink-0">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm leading-tight">{u.name}</h4>
                    <p className="text-xs text-slate-500">{u.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                        {u.role_name}
                      </span>
                      {u.device_id && (
                        <span className="text-[9px] font-mono text-slate-400 flex items-center gap-1">
                          <Smartphone className="w-3 h-3 text-slate-400" />
                          {u.device_id}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleUserActive(u)}
                    className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-colors ${
                      u.active === 1
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                        : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                    }`}
                  >
                    {u.active === 1 ? 'Ativo' : 'Inativo'}
                  </button>

                  {can('users', 'manage') && u.role_id !== 'role_admin' && (
                    <button
                      onClick={() => handleDeleteUser(u)}
                      className="p-2 text-slate-400 hover:text-red-500 rounded-xl hover:bg-red-50 transition-colors"
                      title="Excluir Usuário"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT ROLE */}
      {roleModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-extrabold text-slate-900 text-base">
                {editingRole ? `Editar Perfil: ${editingRole.name}` : 'Criar Perfil Customizado'}
              </h3>
              <button
                onClick={() => setRoleModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome do Perfil *</label>
                <input
                  type="text"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  placeholder="Ex: Supervisor de Campo ou Líder de APR"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Descrição das Atribuições</label>
                <input
                  type="text"
                  value={roleDescription}
                  onChange={(e) => setRoleDescription(e.target.value)}
                  placeholder="Ex: Emite APRs e visualiza o mapa de riscos da fábrica"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Granular Permissions Grid */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-2">
                  Definir Permissões Módulo a Módulo:
                </label>
                <div className="space-y-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  {MODULES_LIST.map(mod => (
                    <div key={mod.key} className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                      <span className="font-bold text-xs text-slate-900 block mb-1.5">{mod.name}</span>
                      <div className="flex flex-wrap gap-2">
                        {mod.actions.map(act => {
                          const isChecked = (rolePermissions[mod.key] || []).includes(act);
                          return (
                            <label
                              key={act}
                              className={`text-[11px] font-medium px-2 py-1 rounded-lg border cursor-pointer flex items-center gap-1.5 transition-colors ${
                                isChecked
                                  ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold'
                                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleTogglePermission(mod.key, act)}
                                className="rounded text-amber-500 focus:ring-amber-500 w-3 h-3"
                              />
                              <span>{ACTION_LABELS[act] || act}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRoleModalOpen(false)}
                  className="py-2.5 px-4 text-xs font-semibold text-slate-500 hover:text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="py-2.5 px-5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-colors"
                >
                  Salvar Perfil
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE USER */}
      {userModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-extrabold text-slate-900 text-base">Cadastrar Novo Usuário</h3>
              <button
                onClick={() => setUserModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Ex: Maria Santos"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail de Login *</label>
                <input
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="maria.santos@empresa.com.br"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Senha de Acesso *</label>
                <input
                  type="password"
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Perfil de Acesso *</label>
                <select
                  value={userRoleId}
                  onChange={(e) => setUserRoleId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-xl bg-white"
                  required
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  className="py-2.5 px-4 text-xs font-semibold text-slate-500 hover:text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="py-2.5 px-5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-colors"
                >
                  Cadastrar Usuário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
