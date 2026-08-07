"use client";

import { useEffect, useState } from "react";
import { Car, Plus, Search, Edit2, Trash2, X, Filter, Loader2, Tag, CheckCircle } from "lucide-react";
import { getVehicleStock, createVehicleStock, updateVehicleStock, deleteVehicleStock } from "../actions/actions";
import { SkeletonCards, SkeletonTable } from "../components/SkeletonUI";

const formatLKR = (amount: number) => {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
  }).format(amount || 0);
};

export default function StockPage() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<any | null>(null);

  const [formData, setFormData] = useState({
    make: "",
    model: "",
    year: new Date().getFullYear(),
    vin: "",
    regNumber: "",
    color: "",
    mileage: 0,
    fuelType: "Petrol",
    transmission: "Automatic",
    buyPrice: 0,
    askingPrice: 0,
    status: "Available",
    description: "",
    imageUrl: "",
  });

  const loadStock = async () => {
    setLoading(true);
    try {
      const stock = await getVehicleStock();
      setVehicles(stock);
    } catch (err) {
      console.error("Failed to load vehicle stock:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStock();

    const handleOpenNew = () => handleOpenModal();
    window.addEventListener("stock:open-new", handleOpenNew);
    return () => {
      window.removeEventListener("stock:open-new", handleOpenNew);
    };
  }, []);

  const handleOpenModal = (vehicle?: any) => {
    if (vehicle) {
      setEditingVehicle(vehicle);
      setFormData({
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        vin: vehicle.vin,
        regNumber: vehicle.regNumber,
        color: vehicle.color,
        mileage: vehicle.mileage,
        fuelType: vehicle.fuelType,
        transmission: vehicle.transmission,
        buyPrice: vehicle.buyPrice,
        askingPrice: vehicle.askingPrice,
        status: vehicle.status,
        description: vehicle.description,
        imageUrl: vehicle.imageUrl,
      });
    } else {
      setEditingVehicle(null);
      setFormData({
        make: "",
        model: "",
        year: new Date().getFullYear(),
        vin: "",
        regNumber: "",
        color: "",
        mileage: 0,
        fuelType: "Petrol",
        transmission: "Automatic",
        buyPrice: 0,
        askingPrice: 0,
        status: "Available",
        description: "",
        imageUrl: "",
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.make || !formData.model || !formData.year) {
      alert("Please fill in Make, Model, and Year");
      return;
    }

    setSaving(true);
    try {
      if (editingVehicle) {
        await updateVehicleStock(editingVehicle.id, formData);
      } else {
        await createVehicleStock(formData);
      }
      setIsModalOpen(false);
      await loadStock();
    } catch (err) {
      console.error("Failed to save vehicle:", err);
      alert("Failed to save vehicle. Please check connection.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to remove this vehicle from stock?")) return;
    try {
      await deleteVehicleStock(id);
      await loadStock();
    } catch (err) {
      console.error("Failed to delete vehicle:", err);
    }
  };

  const filteredVehicles = vehicles.filter((v) => {
    const matchesSearch =
      v.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.regNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.vin.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "All" || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const availableCount = vehicles.filter((v) => v.status === "Available").length;
  const reservedCount = vehicles.filter((v) => v.status === "Reserved").length;
  const soldCount = vehicles.filter((v) => v.status === "Sold").length;
  const totalStockValue = vehicles
    .filter((v) => v.status === "Available")
    .reduce((sum, v) => sum + (v.askingPrice || 0), 0);

  return (
    <div className="space-y-6">
      

      {/* Stats */}
      {loading ? (
        <SkeletonCards count={4} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-[#ffffff] border border-[#e2e8f0] rounded-3xl p-6 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="p-4 rounded-2xl bg-indigo-50 text-indigo-600">
              <Car className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[#64748b] text-sm font-medium">Total Vehicles</p>
              <p className="text-2xl font-bold text-[#0f172a] mt-0.5">{vehicles.length}</p>
            </div>
          </div>

          <div className="bg-[#ffffff] border border-[#e2e8f0] rounded-3xl p-6 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-600">
              <Car className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[#64748b] text-sm font-medium">Available Stock</p>
              <p className="text-2xl font-bold text-[#0f172a] mt-0.5">{availableCount}</p>
            </div>
          </div>

          <div className="bg-[#ffffff] border border-[#e2e8f0] rounded-3xl p-6 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="p-4 rounded-2xl bg-amber-50 text-amber-600">
              <Tag className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[#64748b] text-sm font-medium">Reserved Vehicles</p>
              <p className="text-2xl font-bold text-[#0f172a] mt-0.5">{reservedCount}</p>
            </div>
          </div>

          <div className="bg-[#ffffff] border border-[#e2e8f0] rounded-3xl p-6 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="p-4 rounded-2xl bg-purple-50 text-purple-600">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[#64748b] text-sm font-medium">Sold Vehicles</p>
              <p className="text-2xl font-bold text-[#0f172a] mt-0.5">{soldCount}</p>
            </div>
          </div>
        </div>
      )}

      {/* Category / Status Filter Pills & Search */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Category Pills */}
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {["All", "Available", "Reserved", "Sold"].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all cursor-pointer ${
                statusFilter === status
                  ? "bg-[#002f4c] text-[#ffffff] shadow-sm font-semibold"
                  : "bg-[#ffffff] border border-[#e2e8f0] text-[#475569] hover:bg-[#f1f5f9]"
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
          <input
            type="text"
            placeholder="Search make, model, reg, VIN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#ffffff] border border-[#e2e8f0] rounded-full pl-9 pr-4 py-2 text-sm text-[#0f172a] placeholder-[#94a3b8] outline-none focus:border-[#002f4c] shadow-xs transition-all"
          />
        </div>
      </div>

      {/* Inventory Table */}
      {loading ? (
        <SkeletonTable rows={5} />
      ) : (
        <div className="bg-[#ffffff] border border-[#e2e8f0] rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#e2e8f0] text-[#64748b] text-sm">
                  <th className="p-4 font-medium">Vehicle Details</th>
                  <th className="p-4 font-medium">Year & Specs</th>
                  <th className="p-4 font-medium">Reg / Chassis</th>
                  <th className="p-4 font-medium">Buy Price</th>
                  <th className="p-4 font-medium">Selling Price</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9] text-[#0f172a]">
                {filteredVehicles.map((v) => (
                  <tr key={v.id} className="hover:bg-[#f8fafc] transition-colors">
                    <td className="p-4">
                      <div className="font-semibold text-[#0f172a] text-sm">{v.make} {v.model}</div>
                      <div className="text-xs text-[#64748b] flex items-center gap-2 mt-0.5">
                        <span>Color: {v.color || "N/A"}</span>
                        <span>•</span>
                        <span>Mileage: {v.mileage.toLocaleString()} km</span>
                      </div>
                    </td>
                    <td className="p-4 text-sm">
                      <div className="font-semibold text-[#0f172a]">{v.year}</div>
                      <div className="text-xs text-[#64748b]">{v.fuelType} • {v.transmission}</div>
                    </td>
                    <td className="p-4 text-sm text-[#334155]">
                      <div className="font-semibold text-[#0f172a]">{v.regNumber || "Unregistered"}</div>
                      <div className="text-xs text-[#94a3b8]">{v.vin || "No VIN"}</div>
                    </td>
                    <td className="p-4 text-sm text-[#64748b]">
                      {formatLKR(v.buyPrice)}
                    </td>
                    <td className="p-4 text-sm font-semibold text-[#15803d]">
                      {formatLKR(v.askingPrice)}
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                          v.status === "Available"
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                            : v.status === "Reserved"
                            ? "bg-amber-50 border-amber-200 text-amber-700"
                            : "bg-gray-100 border-gray-200 text-gray-700"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            v.status === "Available"
                              ? "bg-emerald-600"
                              : v.status === "Reserved"
                              ? "bg-amber-600"
                              : "bg-gray-500"
                          }`}
                        />
                        {v.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenModal(v)}
                          className="p-2 hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#0f172a] rounded-xl transition-colors cursor-pointer"
                          title="Edit Vehicle"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(v.id)}
                          className="p-2 hover:bg-red-50 text-[#64748b] hover:text-red-600 rounded-xl transition-colors cursor-pointer"
                          title="Delete Vehicle"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredVehicles.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-[#64748b]">
                      No vehicles found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Vehicle Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#f8fafc] text-[#0f172a] border border-[#cbd5e1] rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-[#e2e8f0] bg-[#ffffff]">
              <div>
                <h2 className="text-xl font-bold text-[#0f172a]">
                  {editingVehicle ? "Edit Vehicle Stock" : "Add Vehicle to Stock"}
                </h2>
                <p className="text-xs text-[#64748b] mt-0.5">Enter the vehicle details to manage inventory</p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#0f172a] rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 space-y-4 overflow-y-auto flex-1 bg-[#f8fafc]">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#334155]">Make *</label>
                    <input
                      type="text"
                      placeholder="e.g. Toyota"
                      value={formData.make}
                      onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                      required
                      className="w-full bg-[#ffffff] border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-sm text-[#0f172a] placeholder-[#94a3b8] outline-none focus:border-[#002f4c] transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#334155]">Model *</label>
                    <input
                      type="text"
                      placeholder="e.g. Land Cruiser"
                      value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      required
                      className="w-full bg-[#ffffff] border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-sm text-[#0f172a] placeholder-[#94a3b8] outline-none focus:border-[#002f4c] transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#334155]">Year *</label>
                    <input
                      type="number"
                      value={formData.year}
                      onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || 0 })}
                      required
                      className="w-full bg-[#ffffff] border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-sm text-[#0f172a] outline-none focus:border-[#002f4c] transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#334155]">Reg Number</label>
                    <input
                      type="text"
                      placeholder="e.g. CAD-1234"
                      value={formData.regNumber}
                      onChange={(e) => setFormData({ ...formData, regNumber: e.target.value })}
                      className="w-full bg-[#ffffff] border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-sm text-[#0f172a] placeholder-[#94a3b8] outline-none focus:border-[#002f4c] transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#334155]">Chassis Number</label>
                    <input
                      type="text"
                      placeholder="Chassis / VIN"
                      value={formData.vin}
                      onChange={(e) => setFormData({ ...formData, vin: e.target.value })}
                      className="w-full bg-[#ffffff] border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-sm text-[#0f172a] placeholder-[#94a3b8] outline-none focus:border-[#002f4c] transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#334155]">Color</label>
                    <input
                      type="text"
                      placeholder="e.g. Pearl White"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="w-full bg-[#ffffff] border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-sm text-[#0f172a] placeholder-[#94a3b8] outline-none focus:border-[#002f4c] transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#334155]">Mileage (km)</label>
                    <input
                      type="number"
                      value={formData.mileage}
                      onChange={(e) => setFormData({ ...formData, mileage: parseInt(e.target.value) || 0 })}
                      className="w-full bg-[#ffffff] border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-sm text-[#0f172a] outline-none focus:border-[#002f4c] transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#334155]">Fuel Type</label>
                    <select
                      value={formData.fuelType}
                      onChange={(e) => setFormData({ ...formData, fuelType: e.target.value })}
                      className="w-full bg-[#ffffff] border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-sm text-[#0f172a] outline-none focus:border-[#002f4c] transition-all cursor-pointer"
                    >
                      <option value="Petrol">Petrol</option>
                      <option value="Diesel">Diesel</option>
                      <option value="Hybrid">Hybrid</option>
                      <option value="Electric">Electric</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#334155]">Transmission</label>
                    <select
                      value={formData.transmission}
                      onChange={(e) => setFormData({ ...formData, transmission: e.target.value })}
                      className="w-full bg-[#ffffff] border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-sm text-[#0f172a] outline-none focus:border-[#002f4c] transition-all cursor-pointer"
                    >
                      <option value="Automatic">Automatic</option>
                      <option value="Manual">Manual</option>
                      <option value="Tiptronic">Tiptronic</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#334155]">Buy Price (LKR)</label>
                    <input
                      type="number"
                      value={formData.buyPrice}
                      onChange={(e) => setFormData({ ...formData, buyPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-[#ffffff] border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-sm text-[#0f172a] font-mono outline-none focus:border-[#002f4c] transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#334155]">Selling Price (LKR)</label>
                    <input
                      type="number"
                      value={formData.askingPrice}
                      onChange={(e) => setFormData({ ...formData, askingPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-[#ffffff] border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-sm text-[#0f172a] font-mono outline-none focus:border-[#002f4c] transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#334155]">Stock Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full bg-[#ffffff] border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-sm text-[#0f172a] outline-none focus:border-[#002f4c] transition-all cursor-pointer"
                    >
                      <option value="Available">Available</option>
                      <option value="Reserved">Reserved</option>
                      <option value="Sold">Sold</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#334155]">Description / Notes</label>
                  <textarea
                    rows={3}
                    placeholder="Optional vehicle notes or extra options..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-[#ffffff] border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-sm text-[#0f172a] placeholder-[#94a3b8] outline-none focus:border-[#002f4c] transition-all"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-[#e2e8f0] flex justify-end gap-3 bg-[#ffffff]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 rounded-full text-sm font-semibold text-[#475569] hover:bg-[#f1f5f9] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 bg-[#002f4c] hover:bg-[#0a3a5c] text-[#ffffff] rounded-full text-sm font-semibold transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin text-[#ffffff]" />}
                  <span className="text-[#ffffff] font-semibold">{editingVehicle ? "Update Vehicle" : "Save Vehicle"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
