import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Employee, Training, EPI } from '../types';
import { FrontalCameraModal } from '../components/FrontalCameraModal';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Shield,
  Award,
  HardHat,
  Trash2,
  Edit,
  Plus,
  X,
  Phone,
  Mail,
  Calendar,
  QrCode,
  Download,
  Camera,
  Sparkles
} from 'lucide-react';

export const Employees: React.FC = () => {
  const { can } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState('ALL');

  // Modal states
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [manageModalEmployee, setManageModalEmployee] = useState<Employee | null>(null);
  const [badgeQrModal, setBadgeQrModal] = useState<{ employee: Employee; qrDataUrl: string } | null>(null);
  const [faceCaptureEmployee, setFaceCaptureEmployee] = useState<Employee | null>(null);

  const handleSaveFaceBiometrics = async (compressedDataUrl: string) => {
    if (!faceCaptureEmployee) return;
    try {
      await api.post(`/employees/${faceCaptureEmployee.id}/biometrics`, { photo_url: compressedDataUrl });
      loadEmployees();
      setFaceCaptureEmployee(null);
      alert(`Biometria facial de ${faceCaptureEmployee.name} salva com sucesso!`);
    } catch (err: any) {
      alert('Erro ao salvar biometria: ' + (err.message || 'Falha de comunicação.'));
    }
  };

  const handleOpenBadgeQr = async (emp: Employee) => {
    try {
      const origin = encodeURIComponent(window.location.origin);
      const res = await api.get<{ qrCodeDataUrl: string }>(`/employees/${emp.id}/qrcode?origin=${origin}`);
      setBadgeQrModal({ employee: emp, qrDataUrl: res.qrCodeDataUrl });
    } catch (err: any) {
      alert('Erro ao gerar QR Code do crachá: ' + (err.message || 'Falha de comunicação.'));
    }
  };

  // Form states for Create/Edit Employee
  const [formData, setFormData] = useState({
    name: '',
    cpf: '',
    registration_number: '',
    role: '',
    department: '',
    admission_date: '',
    phone: '',
    email: '',
    status: 'ativo' as 'ativo' | 'afastado' | 'desligado'
  });

  // Form states for adding Training
  const [newTraining, setNewTraining] = useState({
    type: 'NR-35 Trabalho em Altura',
    institution: '',
    certificate_number: '',
    completion_date: '',
    expiry_date: ''
  });

  // Form states for adding EPI
  const [newEpi, setNewEpi] = useState({
    name: '',
    ca_number: '',
    delivery_date: '',
    expiry_date: ''
  });

  const [activeTabInManage, setActiveTabInManage] = useState<'trainings' | 'epis'>('trainings');

  const loadEmployees = async () => {
    try {
      const data = await api.get<Employee[]>('/employees');
      setEmployees(data);
    } catch (err) {
      console.error('Erro ao carregar funcionários:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  const openCreateModal = () => {
    setEditingEmployee(null);
    setFormData({
      name: '',
      cpf: '',
      registration_number: '',
      role: '',
      department: '',
      admission_date: new Date().toISOString().split('T')[0],
      phone: '',
      email: '',
      status: 'ativo'
    });
    setEmployeeModalOpen(true);
  };

  const openEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormData({
      name: emp.name,
      cpf: emp.cpf,
      registration_number: emp.registration_number,
      role: emp.role,
      department: emp.department,
      admission_date: emp.admission_date,
      phone: emp.phone || '',
      email: emp.email || '',
      status: emp.status
    });
    setEmployeeModalOpen(true);
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingEmployee) {
        await api.put(`/employees/${editingEmployee.id}`, formData);
      } else {
        await api.post('/employees', formData);
      }
      setEmployeeModalOpen(false);
      loadEmployees();
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar funcionário.');
    }
  };

  const handleDeleteEmployee = async (id: string, name: string) => {
    if (confirm(`Deseja realmente excluir o funcionário ${name} e todos os seus registros de treinamentos e EPIs?`)) {
      try {
        await api.delete(`/employees/${id}`);
        loadEmployees();
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  // Open Training/EPI management modal for a specific employee
  const openManageModal = async (emp: Employee) => {
    try {
      const detailed = await api.get<Employee>(`/employees/${emp.id}`);
      setManageModalEmployee(detailed);
    } catch (err) {
      setManageModalEmployee(emp);
    }
  };

  const handleAddTraining = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manageModalEmployee) return;

    try {
      await api.post(`/employees/${manageModalEmployee.id}/trainings`, newTraining);
      // Reload detailed employee
      const detailed = await api.get<Employee>(`/employees/${manageModalEmployee.id}`);
      setManageModalEmployee(detailed);
      loadEmployees();
      setNewTraining({
        type: 'NR-35 Trabalho em Altura',
        institution: '',
        certificate_number: '',
        completion_date: '',
        expiry_date: ''
      });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteTraining = async (trainingId: string) => {
    if (!manageModalEmployee) return;
    try {
      await api.delete(`/employees/${manageModalEmployee.id}/trainings/${trainingId}`);
      const detailed = await api.get<Employee>(`/employees/${manageModalEmployee.id}`);
      setManageModalEmployee(detailed);
      loadEmployees();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddEpi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manageModalEmployee) return;

    try {
      await api.post(`/employees/${manageModalEmployee.id}/epis`, newEpi);
      const detailed = await api.get<Employee>(`/employees/${manageModalEmployee.id}`);
      setManageModalEmployee(detailed);
      loadEmployees();
      setNewEpi({
        name: '',
        ca_number: '',
        delivery_date: '',
        expiry_date: ''
      });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteEpi = async (epiId: string) => {
    if (!manageModalEmployee) return;
    try {
      await api.delete(`/employees/${manageModalEmployee.id}/epis/${epiId}`);
      const detailed = await api.get<Employee>(`/employees/${manageModalEmployee.id}`);
      setManageModalEmployee(detailed);
      loadEmployees();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const departments = Array.from(new Set(employees.map(e => e.department))).filter(Boolean);

  const filteredEmployees = employees.filter(e => {
    const matchesSearch =
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.cpf.includes(searchTerm) ||
      e.role.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = filterDept === 'ALL' || e.department === filterDept;
    return matchesSearch && matchesDept;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-500" />
            Gestão de Funcionários & Competências SST
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Cadastro de informações pessoais, controle de EPIs e vencimento de NR-35, NR-33 e ASO
          </p>
        </div>

        {can('employees', 'create') && (
          <button
            onClick={openCreateModal}
            className="py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-md shadow-amber-500/20 transition-all hover:scale-[1.02]"
          >
            <UserPlus className="w-4 h-4" />
            Novo Funcionário
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, CPF ou cargo..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 bg-white px-3 py-2 border border-slate-200 rounded-xl">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="ALL">Todos os Setores</option>
            {departments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Employee Cards Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs text-slate-400">Carregando quadro de funcionários...</p>
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-3xl border border-slate-200 p-8">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-700 text-sm">Nenhum funcionário encontrado</h3>
          <p className="text-xs text-slate-400 mt-1">Tente ajustar a busca ou cadastre um novo colaborador.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEmployees.map(emp => (
            <div
              key={emp.id}
              className={`bg-white rounded-3xl p-5 border shadow-sm transition-all hover:shadow-md flex flex-col justify-between ${
                emp.complianceStatus === 'critico'
                  ? 'border-red-300 ring-1 ring-red-200'
                  : emp.complianceStatus === 'alerta'
                  ? 'border-amber-300'
                  : 'border-slate-200'
              }`}
            >
              <div>
                {/* Card Top: Avatar, Name & Compliance status */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    {emp.photo_url ? (
                      <img
                        src={emp.photo_url}
                        alt={emp.name}
                        className="w-11 h-11 rounded-2xl object-cover border-2 border-emerald-400 shadow-sm shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-2xl bg-slate-900 text-amber-400 flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
                        {emp.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm leading-tight">{emp.name}</h4>
                      <p className="text-xs font-medium text-slate-500">{emp.role}</p>
                      <span className="text-[10px] text-slate-400">{emp.department}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    {/* Status Indicator */}
                    {emp.complianceStatus === 'critico' ? (
                      <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 animate-pulse" title="Treinamento Vencido!">
                        <AlertTriangle className="w-3 h-3" />
                        Vencido
                      </span>
                    ) : emp.complianceStatus === 'alerta' ? (
                      <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0" title="Vence em menos de 30 dias">
                        <Clock className="w-3 h-3" />
                        Vence Breve
                      </span>
                    ) : (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                        <CheckCircle2 className="w-3 h-3" />
                        Em Dia
                      </span>
                    )}

                    {emp.photo_url ? (
                      <span className="text-[9px] bg-teal-50 text-teal-700 font-semibold px-1.5 py-0.2 rounded border border-teal-200 flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5 text-teal-600" />
                        Face OK
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Personal / Registration details */}
                <div className="space-y-1 text-xs text-slate-600 bg-slate-50 p-3 rounded-2xl mb-3">
                  <div className="flex justify-between">
                    <span className="text-slate-400">CPF:</span>
                    <span className="font-medium text-slate-800">{emp.cpf}</span>
                  </div>
                  {emp.registration_number && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Matrícula:</span>
                      <span className="font-medium text-slate-800">{emp.registration_number}</span>
                    </div>
                  )}
                  {emp.phone && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Contato:</span>
                      <span className="text-slate-700 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {emp.phone}
                      </span>
                    </div>
                  )}
                </div>

                {/* Safety Training Badges */}
                <div className="mb-3 space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Aptidão Operacional SST:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {/* NR-35 Altura Badge */}
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg flex items-center gap-1 ${
                        emp.nr35Status === 'valido'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : emp.nr35Status === 'prestes_a_vencer'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : emp.nr35Status === 'vencido'
                          ? 'bg-red-50 text-red-700 border border-red-200 font-bold'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      🧗 NR-35 {emp.nr35Status === 'valido' ? 'Válida' : emp.nr35Status === 'vencido' ? 'VENCIDA' : emp.nr35Status === 'prestes_a_vencer' ? 'Vence Breve' : 'Não tem'}
                    </span>

                    {/* NR-33 Espaço Confinado Badge */}
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg flex items-center gap-1 ${
                        emp.nr33Status === 'valido'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : emp.nr33Status === 'prestes_a_vencer'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : emp.nr33Status === 'vencido'
                          ? 'bg-red-50 text-red-700 border border-red-200 font-bold'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      🕳️ NR-33 {emp.nr33Status === 'valido' ? 'Válida' : emp.nr33Status === 'vencido' ? 'VENCIDA' : emp.nr33Status === 'prestes_a_vencer' ? 'Vence Breve' : 'Não tem'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => openManageModal(emp)}
                  className="flex-1 py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Award className="w-3.5 h-3.5 text-amber-600" />
                  Treinamentos & EPIs
                </button>

                <button
                  onClick={() => handleOpenBadgeQr(emp)}
                  className="p-2 text-slate-500 hover:text-amber-600 rounded-xl hover:bg-amber-50 border border-slate-200 transition-colors"
                  title="Ver Crachá Digital SST (QR Code)"
                >
                  <QrCode className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setFaceCaptureEmployee(emp)}
                  className={`p-2 rounded-xl border transition-colors ${
                    emp.photo_url
                      ? 'text-teal-600 hover:text-teal-700 bg-teal-50 border-teal-200'
                      : 'text-slate-500 hover:text-amber-600 hover:bg-amber-50 border-slate-200'
                  }`}
                  title={emp.photo_url ? 'Atualizar Biometria Facial (Câmera Frontal)' : 'Cadastrar Biometria Facial (Câmera Frontal)'}
                >
                  <Camera className="w-4 h-4" />
                </button>

                {can('employees', 'edit') && (
                  <button
                    onClick={() => openEditModal(emp)}
                    className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
                    title="Editar Dados Pessoais"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                )}

                {can('employees', 'delete') && (
                  <button
                    onClick={() => handleDeleteEmployee(emp.id, emp.name)}
                    className="p-2 text-slate-400 hover:text-red-500 rounded-xl hover:bg-red-50 transition-colors"
                    title="Excluir Funcionário"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL 1: CREATE / EDIT EMPLOYEE */}
      {employeeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-extrabold text-slate-900 text-base">
                {editingEmployee ? 'Editar Funcionário' : 'Novo Funcionário'}
              </h3>
              <button
                onClick={() => setEmployeeModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: João da Silva Santos"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">CPF *</label>
                  <input
                    type="text"
                    value={formData.cpf}
                    onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                    placeholder="000.000.000-00"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Matrícula</label>
                  <input
                    type="text"
                    value={formData.registration_number}
                    onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                    placeholder="Ex: MAT-1044"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Cargo / Função *</label>
                  <input
                    type="text"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    placeholder="Ex: Eletricista Industrial"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Setor / Área *</label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    placeholder="Ex: Manutenção Elétrica"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Data de Admissão *</label>
                  <input
                    type="date"
                    value={formData.admission_date}
                    onChange={(e) => setFormData({ ...formData, admission_date: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Telefone / WhatsApp</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(11) 98765-4321"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="funcionario@empresa.com.br"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEmployeeModalOpen(false)}
                  className="py-2.5 px-4 text-xs font-semibold text-slate-500 hover:text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="py-2.5 px-5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-colors"
                >
                  {editingEmployee ? 'Salvar Alterações' : 'Cadastrar Funcionário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: MANAGE TRAININGS & EPIS */}
      {manageModalEmployee && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-500" />
                  Competências, Treinamentos & EPIs
                </h3>
                <p className="text-xs text-slate-500">
                  Colaborador: <strong className="text-slate-800">{manageModalEmployee.name}</strong> ({manageModalEmployee.role})
                </p>
              </div>
              <button
                onClick={() => setManageModalEmployee(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub Tabs */}
            <div className="flex border-b border-slate-200 mb-4">
              <button
                onClick={() => setActiveTabInManage('trainings')}
                className={`py-2 px-4 text-xs font-bold border-b-2 flex items-center gap-2 ${
                  activeTabInManage === 'trainings'
                    ? 'border-amber-500 text-slate-900'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                <Award className="w-4 h-4" />
                Treinamentos & Normas Regulamentadoras ({manageModalEmployee.trainings?.length || 0})
              </button>
              <button
                onClick={() => setActiveTabInManage('epis')}
                className={`py-2 px-4 text-xs font-bold border-b-2 flex items-center gap-2 ${
                  activeTabInManage === 'epis'
                    ? 'border-amber-500 text-slate-900'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                <HardHat className="w-4 h-4" />
                Ficha de EPIs Atribuídos ({manageModalEmployee.epis?.length || 0})
              </button>
            </div>

            {/* TAB CONTENT: TRAININGS */}
            {activeTabInManage === 'trainings' && (
              <div className="space-y-4">
                {/* Add new training form */}
                {can('employees', 'edit') && (
                  <form onSubmit={handleAddTraining} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <span className="text-xs font-bold text-slate-800 block">Registrar Novo Treinamento / Certificado:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Norma / Treinamento *</label>
                        <select
                          value={newTraining.type}
                          onChange={(e) => setNewTraining({ ...newTraining, type: e.target.value })}
                          className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                        >
                          <option value="NR-35 Trabalho em Altura">NR-35 Trabalho em Altura</option>
                          <option value="NR-33 Espaço Confinado (Trabalhador e Vigia)">NR-33 Espaço Confinado (Trabalhador e Vigia)</option>
                          <option value="NR-33 Espaço Confinado (Supervisor)">NR-33 Espaço Confinado (Supervisor)</option>
                          <option value="NR-10 Segurança em Eletricidade">NR-10 Segurança em Eletricidade</option>
                          <option value="NR-12 Segurança em Máquinas e Equipamentos">NR-12 Segurança em Máquinas</option>
                          <option value="ASO - Atestado de Saúde Ocupacional">ASO - Atestado de Saúde Ocupacional</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Instituição Instrutora</label>
                        <input
                          type="text"
                          value={newTraining.institution}
                          onChange={(e) => setNewTraining({ ...newTraining, institution: e.target.value })}
                          placeholder="Ex: SENAI, SESI, SEST SENAT"
                          className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Data de Conclusão *</label>
                        <input
                          type="date"
                          value={newTraining.completion_date}
                          onChange={(e) => setNewTraining({ ...newTraining, completion_date: e.target.value })}
                          className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Data de Vencimento *</label>
                        <input
                          type="date"
                          value={newTraining.expiry_date}
                          onChange={(e) => setNewTraining({ ...newTraining, expiry_date: e.target.value })}
                          className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                          required
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 text-amber-400" />
                      Adicionar Treinamento
                    </button>
                  </form>
                )}

                {/* Trainings List */}
                <div className="space-y-2">
                  {manageModalEmployee.trainings && manageModalEmployee.trainings.length > 0 ? (
                    manageModalEmployee.trainings.map(t => (
                      <div
                        key={t.id}
                        className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <h5 className="font-bold text-xs text-slate-900">{t.type}</h5>
                            {t.status === 'vencido' ? (
                              <span className="text-[9px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded">
                                VENCIDO
                              </span>
                            ) : t.status === 'prestes_a_vencer' ? (
                              <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">
                                Vence em breve
                              </span>
                            ) : (
                              <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                                Válido
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Realizado em: {new Date(t.completion_date).toLocaleDateString('pt-BR')} | <strong>Vencimento: {new Date(t.expiry_date).toLocaleDateString('pt-BR')}</strong>
                          </p>
                          {t.institution && (
                            <span className="text-[10px] text-slate-400">Instituição: {t.institution}</span>
                          )}
                        </div>

                        {can('employees', 'edit') && (
                          <button
                            onClick={() => handleDeleteTraining(t.id)}
                            className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-4">Nenhum treinamento registrado ainda.</p>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: EPIS */}
            {activeTabInManage === 'epis' && (
              <div className="space-y-4">
                {/* Add new EPI form */}
                {can('employees', 'edit') && (
                  <form onSubmit={handleAddEpi} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <span className="text-xs font-bold text-slate-800 block">Registrar Entrega de EPI:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Descrição do EPI *</label>
                        <input
                          type="text"
                          value={newEpi.name}
                          onChange={(e) => setNewEpi({ ...newEpi, name: e.target.value })}
                          placeholder="Ex: Cinto Paraquedista c/ Talabarte"
                          className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Número do C.A. *</label>
                        <input
                          type="text"
                          value={newEpi.ca_number}
                          onChange={(e) => setNewEpi({ ...newEpi, ca_number: e.target.value })}
                          placeholder="Ex: CA-36399"
                          className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Data de Entrega *</label>
                        <input
                          type="date"
                          value={newEpi.delivery_date}
                          onChange={(e) => setNewEpi({ ...newEpi, delivery_date: e.target.value })}
                          className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Validade / Revisão</label>
                        <input
                          type="date"
                          value={newEpi.expiry_date}
                          onChange={(e) => setNewEpi({ ...newEpi, expiry_date: e.target.value })}
                          className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 text-amber-400" />
                      Registrar Entrega de EPI
                    </button>
                  </form>
                )}

                {/* EPIs List */}
                <div className="space-y-2">
                  {manageModalEmployee.epis && manageModalEmployee.epis.length > 0 ? (
                    manageModalEmployee.epis.map(epi => (
                      <div
                        key={epi.id}
                        className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3"
                      >
                        <div>
                          <h5 className="font-bold text-xs text-slate-900">{epi.name}</h5>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Certificado de Aprovação: <strong>{epi.ca_number}</strong> | Entregue em: {new Date(epi.delivery_date).toLocaleDateString('pt-BR')}
                          </p>
                          {epi.expiry_date && (
                            <span className="text-[10px] text-slate-400">Revisão até: {new Date(epi.expiry_date).toLocaleDateString('pt-BR')}</span>
                          )}
                        </div>

                        {can('employees', 'edit') && (
                          <button
                            onClick={() => handleDeleteEpi(epi.id)}
                            className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-4">Nenhum EPI entregue registrado.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 3: CRACHÁ DIGITAL SST COM QR CODE */}
      {badgeQrModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setBadgeQrModal(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Crachá Card */}
            <div className="text-center p-4 border-2 border-slate-900 rounded-2xl bg-white mb-4">
              <div className="bg-slate-900 text-white py-1.5 px-3 rounded-lg flex items-center justify-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-amber-400" />
                <span className="font-black text-xs tracking-wider uppercase">CRACHÁ DIGITAL SST</span>
              </div>

              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-700 mx-auto flex items-center justify-center text-2xl font-black text-white shadow-md mb-2">
                {badgeQrModal.employee.name.charAt(0)}
              </div>

              <h3 className="font-black text-slate-900 text-base leading-tight">{badgeQrModal.employee.name}</h3>
              <p className="text-xs text-slate-500 font-bold">{badgeQrModal.employee.role}</p>
              <p className="text-[10px] text-slate-400 font-mono mb-3">{badgeQrModal.employee.department} • Matrícula: {badgeQrModal.employee.registration_number || 'S/N'}</p>

              <div className="flex justify-center mb-3">
                <img
                  src={badgeQrModal.qrDataUrl}
                  alt={`QR Code ${badgeQrModal.employee.name}`}
                  className="w-44 h-44 border border-slate-200 rounded-xl p-1 shadow-sm"
                />
              </div>

              <p className="text-[10px] text-slate-500 font-bold leading-tight">
                Aponte a câmera para consultar a validade dos treinamentos (NR-35/NR-33) e EPIs ativos deste trabalhador.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = badgeQrModal.qrDataUrl;
                  a.download = `Cracha_SST_${badgeQrModal.employee.name.replace(/\s+/g, '_')}.png`;
                  a.click();
                }}
                className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Download className="w-4 h-4" />
                Salvar Imagem
              </button>

              <button
                onClick={() => {
                  const win = window.open('', '_blank');
                  if (win) {
                    win.document.write(`
                      <!DOCTYPE html>
                      <html>
                        <head>
                          <title>Crachá SST - ${badgeQrModal.employee.name}</title>
                          <style>
                            @page { size: A4 portrait; margin: 15mm; }
                            * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
                            body { margin: 0; padding: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 90vh; }
                            .badge-card {
                              border: 4px solid #0f172a;
                              border-radius: 20px;
                              width: 100%;
                              max-width: 420px;
                              text-align: center;
                              overflow: hidden;
                              box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                            }
                            .header {
                              background: #0f172a;
                              color: #f59e0b;
                              padding: 14px;
                              font-size: 16px;
                              font-weight: 900;
                              text-transform: uppercase;
                              letter-spacing: 1.5px;
                            }
                            .body {
                              padding: 24px;
                              background: #fff;
                            }
                            .avatar {
                              width: 70px;
                              height: 70px;
                              border-radius: 16px;
                              background: #f59e0b;
                              color: #fff;
                              font-size: 32px;
                              font-weight: 900;
                              display: flex;
                              align-items: center;
                              justify-content: center;
                              margin: 0 auto 12px;
                            }
                            .name {
                              font-size: 20px;
                              font-weight: 900;
                              color: #0f172a;
                              margin: 0 0 4px;
                            }
                            .role {
                              font-size: 14px;
                              font-weight: 700;
                              color: #64748b;
                              margin: 0 0 16px;
                            }
                            .qr {
                              width: 220px;
                              height: 220px;
                              margin: 0 auto 16px;
                              display: block;
                            }
                            .instr {
                              font-size: 12px;
                              color: #334155;
                              font-weight: 600;
                              margin: 0 0 16px;
                            }
                            .footer {
                              border-top: 1px dashed #cbd5e1;
                              padding-top: 10px;
                              font-size: 10px;
                              color: #94a3b8;
                              font-weight: 700;
                              text-transform: uppercase;
                            }
                          </style>
                        </head>
                        <body>
                          <div class="badge-card">
                            <div class="header">🛡️ CRACHÁ DIGITAL SST</div>
                            <div class="body">
                              <div class="avatar">${badgeQrModal.employee.name.charAt(0)}</div>
                              <h2 class="name">${badgeQrModal.employee.name}</h2>
                              <p class="role">${badgeQrModal.employee.role} • ${badgeQrModal.employee.department}</p>
                              <img src="${badgeQrModal.qrDataUrl}" class="qr" />
                              <p class="instr">APONTE A CÂMERA PARA VERIFICAR APTIDÃO (NR-35 / NR-33) E EPIS DO TRABALHADOR</p>
                              <div class="footer">Usina Santa Isabel • SegTrabalho SST</div>
                            </div>
                          </div>
                          <script>
                            window.onload = function() { window.print(); };
                          </script>
                        </body>
                      </html>
                    `);
                    win.document.close();
                  }
                }}
                className="flex-1 py-2.5 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-md transition-colors"
              >
                Imprimir Crachá
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Frontal Camera Viewfinder Modal for Face Biometrics Registration */}
      <FrontalCameraModal
        isOpen={!!faceCaptureEmployee}
        onClose={() => setFaceCaptureEmployee(null)}
        onCapture={handleSaveFaceBiometrics}
        workerName={faceCaptureEmployee?.name}
        title="Cadastro de Biometria Facial SST"
      />
    </div>
  );
};
