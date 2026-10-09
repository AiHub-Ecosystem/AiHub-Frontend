"use client";

import { useCallback, useState, useEffect } from "react";
import type { AcademicSampleRecord } from "@/lib/academic-lab";

export function LabManageView() {
  const [samples, setSamples] = useState<AcademicSampleRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSample, setSelectedSample] =
    useState<AcademicSampleRecord | null>(null);

  // Filters
  const [filterTask, setFilterTask] = useState("");
  const [filterCriterion, setFilterCriterion] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const fetchSamples = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterTask) params.append("task_id", filterTask);
      if (filterCriterion) params.append("criterion", filterCriterion);
      if (filterStatus) params.append("status", filterStatus);

      const res = await fetch(
        `/api/portal/academic/samples?${params.toString()}`
      );
      const data = (await res.json()) as {
        success?: boolean;
        data?: { items?: AcademicSampleRecord[] };
      };
      if (data.success && data.data?.items) {
        setSamples(data.data.items);
      } else {
        // Fallback demo sample if backend not running
        setSamples([
          {
            id: "sample_001",
            createdAt: "2026-08-23T08:30:00Z",
            taskId: "task_2",
            criterion: "LR",
            errorCode: "collocation_error",
            questionType: "short_writing",
            topic: "environment",
            status: "ACCEPTED",
            isFavorite: true,
          },
          {
            id: "sample_002",
            createdAt: "2026-08-23T07:15:00Z",
            taskId: "task_2",
            criterion: "TR",
            errorCode: "inappropriate_structure",
            questionType: "multiple_choice_single",
            topic: "technology",
            status: "REJECTED",
            rejectReason: "Rubric chưa chặt chẽ cho vế kết bài.",
            isFavorite: false,
          },
          {
            id: "sample_003",
            createdAt: "2026-08-22T14:20:00Z",
            taskId: "task_1",
            criterion: "TR",
            errorCode: "lack_comparison_analysis",
            questionType: "annotation",
            topic: "environment",
            status: "ACCEPTED",
            isFavorite: false,
          },
        ]);
      }
    } catch {
      // Local fallback samples
      setSamples([
        {
          id: "sample_001",
          createdAt: "2026-08-23T08:30:00Z",
          taskId: "task_2",
          criterion: "LR",
          errorCode: "collocation_error",
          questionType: "short_writing",
          topic: "environment",
          status: "ACCEPTED",
          isFavorite: true,
        },
        {
          id: "sample_002",
          createdAt: "2026-08-23T07:15:00Z",
          taskId: "task_2",
          criterion: "TR",
          errorCode: "inappropriate_structure",
          questionType: "multiple_choice_single",
          topic: "technology",
          status: "REJECTED",
          rejectReason: "Rubric chưa chặt chẽ cho vế kết bài.",
          isFavorite: false,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [filterTask, filterCriterion, filterStatus]);

  useEffect(() => {
    // The callback starts a fetch and updates React state after its response resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchSamples();
  }, [fetchSamples]);

  const toggleFavorite = (id: string) => {
    setSamples((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isFavorite: !s.isFavorite } : s))
    );
  };

  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-6">
      {/* Top Filter Bar matching FRD Page 13 */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filterTask}
            onChange={(e) => {
              setIsLoading(true);
              setFilterTask(e.target.value);
            }}
            className="text-xs font-semibold p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
          >
            <option value="">Tất cả Task</option>
            <option value="task_1">Task 1</option>
            <option value="task_2">Task 2</option>
          </select>

          <select
            value={filterCriterion}
            onChange={(e) => {
              setIsLoading(true);
              setFilterCriterion(e.target.value);
            }}
            className="text-xs font-semibold p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
          >
            <option value="">Tất cả Tiêu chí</option>
            <option value="TR">Task Response (TR)</option>
            <option value="CC">Coherence & Cohesion (CC)</option>
            <option value="LR">Lexical Resource (LR)</option>
            <option value="GRA_ACC">Grammatical Accuracy</option>
            <option value="GRA_COM">Grammatical Complexity</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => {
              setIsLoading(true);
              setFilterStatus(e.target.value);
            }}
            className="text-xs font-semibold p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
          >
            <option value="">Tất cả Trạng thái</option>
            <option value="ACCEPTED">Accepted (Đã duyệt)</option>
            <option value="REJECTED">Rejected (Từ chối)</option>
          </select>
        </div>

        <button
          onClick={() => {
            setIsLoading(true);
            void fetchSamples();
          }}
          className="px-4 py-1.5 text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1.5"
        >
          <span>↻</span> Làm mới danh sách
        </button>
      </div>

      {/* Samples Inventory Table matching FRD Page 13 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-4 w-10 text-center">★</th>
                <th className="p-4">Ngày tạo</th>
                <th className="p-4">Task</th>
                <th className="p-4">Criteria</th>
                <th className="p-4">Error Code</th>
                <th className="p-4">Question Type</th>
                <th className="p-4">Topic</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {isLoading && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-400">
                    Đang tải danh sách mẫu dữ liệu...
                  </td>
                </tr>
              )}
              {!isLoading && samples.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-gray-400">
                    Chưa có mẫu nào được lưu trong cơ sở dữ liệu. Hãy chuyển
                    sang Tab &apos;Generate Sample&apos; để tạo và chấm mẫu đầu
                    tiên!
                  </td>
                </tr>
              )}
              {!isLoading &&
                samples.map((sample) => (
                  <tr
                    key={sample.id}
                    className="hover:bg-gray-50/80 transition-colors"
                  >
                    <td className="p-4 text-center">
                      <button
                        onClick={() => toggleFavorite(sample.id)}
                        className={`text-sm ${sample.isFavorite ? "text-amber-500" : "text-gray-300 hover:text-amber-400"}`}
                      >
                        ★
                      </button>
                    </td>
                    <td className="p-4 text-gray-900 font-semibold">
                      {new Date(sample.createdAt || "").toLocaleDateString(
                        "vi-VN"
                      )}
                    </td>
                    <td className="p-4 uppercase font-bold text-slate-800">
                      {sample.taskId === "task_1" ? "Task 1" : "Task 2"}
                    </td>
                    <td className="p-4 text-blue-700 font-semibold">
                      {sample.criterion}
                    </td>
                    <td className="p-4 font-mono text-slate-700">
                      {sample.errorCode}
                    </td>
                    <td className="p-4 font-mono text-purple-700">
                      {sample.questionType}
                    </td>
                    <td className="p-4 capitalize">{sample.topic}</td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          sample.status === "ACCEPTED"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {sample.status === "ACCEPTED" ? "Accepted" : "Rejected"}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => setSelectedSample(sample)}
                        className="px-3 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                      >
                        Xem chi tiết →
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sample Detail Modal matching FRD Page 14 */}
      {selectedSample && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  Chi tiết Mẫu: {selectedSample.id}
                </h3>
                <p className="text-xs text-gray-500">
                  {selectedSample.taskId?.toUpperCase()} •{" "}
                  {selectedSample.criterion} • {selectedSample.errorCode} •{" "}
                  {selectedSample.topic}
                </p>
              </div>
              <button
                onClick={() => setSelectedSample(null)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {selectedSample.rejectReason && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900">
                  <span className="font-bold block mb-1">
                    Lý do từ chối (Reject Reason):
                  </span>
                  <p>{selectedSample.rejectReason}</p>
                </div>
              )}

              <div>
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Final Output (Dữ liệu huấn luyện đã duyệt):
                </h4>
                <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-xs overflow-auto max-h-[400px] font-mono leading-relaxed">
                  {JSON.stringify(
                    selectedSample.finalOutput || selectedSample,
                    null,
                    2
                  )}
                </pre>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 flex items-center justify-end bg-gray-50">
              <button
                onClick={() => setSelectedSample(null)}
                className="px-5 py-2 text-xs font-bold bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
