'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Braces,
  Check,
  ChevronDown,
  CircleCheck,
  Clipboard,
  Code2,
  FileAudio,
  Info,
  Mic,
  RotateCcw,
  Search,
  Square,
  Terminal,
  Timer,
  UploadCloud,
  Wifi,
} from 'lucide-react'

import { MAX_SPEAKING_BYTES } from '@/data/speaking-contract'
import {
  type SpeakingPart,
  type SpeakingPrompt,
} from '@/data/speaking-prompts'
import {
  isSpeakingGradingEnvelope,
  type SpeakingGradingEnvelope,
} from '@/data/speaking-response'

type Step = 1 | 2 | 3
type ConsoleTab = 'interface' | 'response' | 'request'
type PublicError = { code: string; message: string }
type QuestionLoadState = 'idle' | 'loading' | 'success' | 'error'

const PARTS: Array<{ value: SpeakingPart; label: string; note: string }> = [
  { value: 1, label: 'Part 1', note: 'Warm-up' },
  { value: 2, label: 'Part 2', note: 'Long turn' },
  { value: 3, label: 'Part 3', note: 'Discussion' },
]

function audioError(file: File) {
  const extension = file.name.toLowerCase().split('.').pop()
  if (!extension || !['wav', 'mp3', 'm4a', 'webm', 'ogg'].includes(extension)) {
    return 'Chọn file WAV, MP3, M4A, WEBM hoặc OGG.'
  }
  if (file.size < 100) return 'File audio cần có ít nhất 100 bytes.'
  if (file.size > MAX_SPEAKING_BYTES) return 'Audio phải nhỏ hơn hoặc bằng 25 MB.'
  return null
}

function errorFromPayload(payload: unknown): PublicError {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'error' in payload &&
    typeof payload.error === 'object' &&
    payload.error !== null &&
    'code' in payload.error &&
    'message' in payload.error &&
    typeof payload.error.code === 'string' &&
    typeof payload.error.message === 'string'
  ) {
    return { code: payload.error.code, message: payload.error.message }
  }
  return { code: 'AI_SERVICE_UNAVAILABLE', message: 'Không đọc được kết quả. Thử lại sau nhé.' }
}

function promptsFromPayload(payload: unknown, part: SpeakingPart): SpeakingPrompt[] | null {
  if (typeof payload !== 'object' || payload === null || !('data' in payload) || typeof payload.data !== 'object' || payload.data === null || !('questions' in payload.data) || !Array.isArray(payload.data.questions)) return null
  const prompts = payload.data.questions.map((item) => {
    if (typeof item !== 'object' || item === null || !('id' in item) || !('part' in item) || !('question' in item) || !('sampleAudioUrl' in item) || typeof item.id !== 'string' || typeof item.part !== 'number' || item.part !== part || typeof item.question !== 'string' || typeof item.sampleAudioUrl !== 'string') return null
    return { id: item.id, part: item.part as SpeakingPart, question: item.question, sampleAudioUrl: item.sampleAudioUrl } satisfies SpeakingPrompt
  })
  return prompts.some((prompt) => prompt === null) ? null : prompts as SpeakingPrompt[]
}

function FeedbackDashboard({ result }: { result: SpeakingGradingEnvelope }) {
  const [analysisTab, setAnalysisTab] = useState<'grammar' | 'vocab'>('grammar')
  const { data } = result
  const bands = [
    ['Fluency & Coherence', data.estimated_band.fluency_coherence, 'Natural pace'],
    ['Lexical Resource', data.estimated_band.lexical_resource, 'Good range'],
    ['Grammar Range & Accuracy', data.estimated_band.grammatical_range_accuracy, 'Mostly accurate'],
    ['Pronunciation', data.estimated_band.pronunciation, 'Clear delivery'],
  ] as const
  const words = data.pronunciation_detail.words
  const grammarErrors = data.language_analysis.grammar_errors
  const vocabularyUpgrades = data.language_analysis.vocabulary_upgrades

  return (
    <div className="feedback-dashboard" data-testid="panel-feedback-dashboard">
      <div className="feedback-header">
        <div>
          <h3>IELTS Speaking Evaluation</h3>
          <p>SpeechAce-compatible response visualization · AIHUB rubric response</p>
        </div>
        <span className="score-badge">Overall Band: {data.scorability.display_band ? data.estimated_band.overall.toFixed(1) : '—'}</span>
      </div>
      <div className="feedback-meta">
        <span>Request: {result.meta.request_id}</span>
        <span>Scorability: {data.scorability.confidence}</span>
        <span>Duration: {data.transcript.duration_seconds.toFixed(1)}s</span>
      </div>
      {!data.relevance.on_topic && (
        <div className="relevance warning">
          <AlertTriangle size={14} />
          <span><strong>Lạc đề (Relevance Score: {Math.round(data.relevance.score * 100)}%)</strong><br />{data.relevance.feedback_vi ?? 'Câu trả lời chưa bám sát câu hỏi.'}</span>
        </div>
      )}
      <div className="feedback-grid">
        {bands.map(([label, score, note]) => (
          <div className="score-card" key={label}>
            <div className="score-label"><span>{label}</span><Check size={11} color="#7ca5ff" /></div>
            <div className="score-value">{score.toFixed(1)} <em>/ 9.0</em></div>
            <div className="score-note">{note}</div>
            <div className="progress-bar"><i style={{ width: (Math.min(100, (score / 9) * 100) + '%') }} /></div>
          </div>
        ))}
      </div>
      <div className="transcript-section">
        <div className="section-kicker">TRANSCRIPT & PHÁT ÂM TỪNG TỪ <span>{data.transcript.word_count} words · {data.transcript.duration_seconds.toFixed(1)}s duration</span></div>
        <div className="count-row">
          <span className="count good-count">{data.pronunciation_detail.summary.good_count} Tốt (Good)</span>
          <span className="count fair-count">{data.pronunciation_detail.summary.fair_count} Khá (Fair)</span>
          <span className="count poor-count">{data.pronunciation_detail.summary.poor_count} Cần cải thiện (Poor)</span>
        </div>
        <div className="transcript">
          {(words.length ? words : data.transcript.text.split(/\s+/).filter(Boolean).map((word) => ({ word, quality_score: 0, quality_class: 'unknown', syllables: [], phonemes: [] }))).map((item, index) => {
            const kind = item.quality_score >= 80 ? 'good' : item.quality_score >= 60 ? 'fair' : 'poor'
            return <span className={'word-chip ' + kind} key={item.word + '-' + index}>{item.word} <small>{item.quality_score}</small></span>
          })}
        </div>
      </div>
      <div className="analysis-panel language-analysis">
        <div className="analysis-tabs">
          <button className={analysisTab === 'grammar' ? 'active' : ''} onClick={() => setAnalysisTab('grammar')} type="button">Lỗi Ngữ Pháp <span>(Grammar Errors)</span></button>
          <button className={analysisTab === 'vocab' ? 'active' : ''} onClick={() => setAnalysisTab('vocab')} type="button">Nâng Cấp Từ Vựng <span>(Vocab Upgrades)</span></button>
        </div>
        {analysisTab === 'grammar' ? (
          grammarErrors.length ? (
            <div className="grammar-error">
              {grammarErrors.map((item, index) => (
                <div className="analysis-item" key={item.error_segment + '-' + index}>
                  <div className="sentence"><del>{item.error_segment}</del> <ins>{item.correction}</ins></div>
                  <blockquote>{item.explanation_vi}</blockquote>
                </div>
              ))}
            </div>
          ) : <p className="empty-state">Không phát hiện lỗi ngữ pháp đáng kể trong câu trả lời này.</p>
        ) : (
          vocabularyUpgrades.length ? (
            <div className="vocab-list">
              {vocabularyUpgrades.map((item, index) => (
                <div className="vocab-card" key={item.original_word + '-' + index}>
                  <div><strong>{item.original_word}</strong><span>➜</span><strong className="upgrade">{item.suggested_word}</strong></div>
                  <div className="analysis-badges"><span>{item.cefr_level}</span>{item.context && <span>{item.context}</span>}</div>
                  <p>{item.reason_vi}</p>
                </div>
              ))}
            </div>
          ) : <p className="empty-state">Chưa có gợi ý từ vựng cho câu trả lời này.</p>
        )}
      </div>
      <div className="rubric-grid">
        {[
          ['Nhận xét chung', data.feedback.summary_vi],
          ['Điểm mạnh', data.feedback.strong_point_vi],
          ['Kế hoạch hành động', data.feedback.action_plan_vi],
        ].map(([title, text]) => (
          <div className="rubric-card" key={title}>
            <div className="section-kicker"><Check size={11} /> {title}</div>
            <p>{text}</p>
          </div>
        ))}
      </div>
      <div className="console-footer timing-footer">
        <span>Request <strong>{result.meta.request_id}</strong></span>
        <span>{data.relevance.on_topic ? 'On topic' : 'Review relevance'} · {data.scorability.message_vi ?? 'Evaluation complete'}</span>
      </div>
    </div>
  )
}

function StepRow({
  number,
  label,
  open,
  locked,
  complete,
  onClick,
}: {
  number: number
  label: string
  open: boolean
  locked?: boolean
  complete?: boolean
  onClick: () => void
}) {
  return (
    <button
      aria-disabled={locked}
      aria-expanded={open}
      className={'step-row ' + (locked ? 'locked ' : '') + (complete ? 'complete' : '')}
      data-testid={'button-toggle-step-' + number}
      disabled={locked}
      onClick={onClick}
      type="button"
    >
      <span className="step-num">{complete ? <Check size={11} /> : number}</span>
      <span className="step-label">{label}</span>
      {locked ? <span className="step-lock">LOCKED</span> : <ChevronDown size={14} className={'chevron ' + (open ? 'open' : '')} />}
    </button>
  )
}

export default function SpeakingWorkbench() {
  const [part, setPart] = useState<SpeakingPart>(1)
  const [query, setQuery] = useState('')
  const [questionOpen, setQuestionOpen] = useState(false)
  const [questions, setQuestions] = useState<SpeakingPrompt[]>([])
  const [questionLoadState, setQuestionLoadState] = useState<QuestionLoadState>('loading')
  const [selectedPrompt, setSelectedPrompt] = useState<SpeakingPrompt | null>(null)
  const [hasConfirmedPrompt, setHasConfirmedPrompt] = useState(false)
  const [step, setStep] = useState<Step>(1)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [sampleAudioUrl, setSampleAudioUrl] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle')
  const [result, setResult] = useState<SpeakingGradingEnvelope | null>(null)
  const [error, setError] = useState<PublicError | null>(null)
  const [consoleStep, setConsoleStep] = useState<Step>(1)
  const [consoleTab, setConsoleTab] = useState<ConsoleTab>('response')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordedBytesRef = useRef(0)
  const previewUrlRef = useRef<string | null>(null)
  const cancelRecordingRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const prompts = useMemo(
    () => questions.filter((prompt) => prompt.question.toLowerCase().includes(query.toLowerCase().trim())),
    [questions, query],
  )

  useEffect(() => () => {
    cancelRecordingRef.current = true
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
    streamRef.current?.getTracks().forEach((track) => track.stop())
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/demo/speaking/questions?part=' + part, { cache: 'no-store' })
      .then(async (response) => {
        const payload: unknown = await response.json().catch(() => null)
        if (!response.ok) throw errorFromPayload(payload)
        const loaded = promptsFromPayload(payload, part)
        if (!loaded) throw new Error('invalid question payload')
        if (!cancelled) {
          setQuestions(loaded)
          setQuestionLoadState('success')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQuestions([])
          setQuestionLoadState('error')
        }
      })
    return () => { cancelled = true }
  }, [part])

  useEffect(() => {
    if (!recording) return
    const timer = window.setInterval(() => setRecordingSeconds((seconds) => seconds + 1), 1000)
    return () => window.clearInterval(timer)
  }, [recording])

  const clearFile = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = null
    setPreviewUrl(null)
    setFile(null)
    setSampleAudioUrl(null)
  }

  const stopRecorder = (discard = false) => {
    if (discard) cancelRecordingRef.current = true
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
      return
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    recorderRef.current = null
    setRecording(false)
    setRecordingSeconds(0)
  }

  const selectPrompt = (prompt: SpeakingPrompt) => {
    stopRecorder(true)
    setSelectedPrompt(prompt)
    setQuestionOpen(false)
    setHasConfirmedPrompt(false)
    clearFile()
    setSampleAudioUrl(prompt.sampleAudioUrl ?? null)
    setStep(1)
    setConsoleStep(1)
    setError(null)
    setResult(null)
    setStatus('idle')
  }

  const selectPart = (nextPart: SpeakingPart) => {
    stopRecorder(true)
    clearFile()
    setQuestionLoadState('loading')
    setPart(nextPart)
    setQuery('')
    setSelectedPrompt(null)
    setHasConfirmedPrompt(false)
    setResult(null)
    setStep(1)
    setConsoleStep(1)
    setError(null)
    setStatus('idle')
  }

  const confirmPrompt = () => {
    if (!selectedPrompt) return
    setHasConfirmedPrompt(true)
    setStep(2)
    setConsoleStep(2)
    setError(null)
  }

  const setAudio = (nextFile: File | null) => {
    if (!nextFile || status === 'submitting') return
    const validationError = audioError(nextFile)
    if (validationError) {
      setError({ code: 'INVALID_REQUEST', message: validationError })
      return
    }
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = URL.createObjectURL(nextFile)
    setPreviewUrl(previewUrlRef.current)
    setFile(nextFile)
    setSampleAudioUrl(null)
    setResult(null)
    setStatus('idle')
    setError(null)
    setStep(2)
    setConsoleStep(2)
  }

  const startRecording = async () => {
    if (status === 'submitting') return
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError({ code: 'RECORDER_UNAVAILABLE', message: 'Trình duyệt này chưa hỗ trợ ghi âm. Bạn có thể tải file audio lên.' })
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      recordedBytesRef.current = 0
      cancelRecordingRef.current = false
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : undefined
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      recorder.ondataavailable = (event) => {
        if (!event.data.size) return
        recordedBytesRef.current += event.data.size
        if (recordedBytesRef.current > MAX_SPEAKING_BYTES) {
          cancelRecordingRef.current = true
          setError({ code: 'PAYLOAD_TOO_LARGE', message: 'Bản ghi đã vượt quá giới hạn 25 MB.' })
          if (recorder.state !== 'inactive') recorder.stop()
          return
        }
        chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        recorderRef.current = null
        setRecording(false)
        setRecordingSeconds(0)
        if (cancelRecordingRef.current) {
          cancelRecordingRef.current = false
          return
        }
        const recordedFile = new File([blob], `speaking-${Date.now()}.webm`, { type: blob.type || 'audio/webm' })
        setAudio(recordedFile)
      }
      recorderRef.current = recorder
      setRecordingSeconds(0)
      setRecording(true)
      recorder.start()
    } catch {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      recorderRef.current = null
      setRecording(false)
      setRecordingSeconds(0)
      setError({ code: 'RECORDER_UNAVAILABLE', message: 'Không thể mở micro. Kiểm tra quyền microphone hoặc tải file audio lên.' })
    }
  }

  const stopRecording = () => stopRecorder()

  const submitLive = async () => {
    const prompt = selectedPrompt
    if ((!file && !sampleAudioUrl) || !prompt) {
      setError({ code: 'INVALID_REQUEST', message: 'Chọn hoặc ghi một câu trả lời trước khi chấm điểm.' })
      return
    }
    setStatus('submitting')
    setError(null)
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 90_000)
    try {
      const request = file
        ? (() => {
            const form = new FormData()
            form.append('audio', file, file.name)
            form.append('part', String(prompt.part))
            form.append('question_id', prompt.id)
            form.append('prompt_text', prompt.question)
            return { endpoint: '/api/demo/speaking/grading', body: form }
          })()
        : {
            endpoint: '/api/demo/speaking/grading-json',
            body: JSON.stringify({ audio_url: sampleAudioUrl, part: prompt.part, question_id: prompt.id, prompt_text: prompt.question, test_type: 'Practice' }),
          }
      const response = await fetch(request.endpoint, {
        method: 'POST',
        body: request.body,
        headers: file ? undefined : { 'Content-Type': 'application/json' },
        signal: controller.signal,
      })
      const payload: unknown = await response.json().catch(() => null)
      if (!response.ok) throw errorFromPayload(payload)
      if (!isSpeakingGradingEnvelope(payload)) throw { code: 'AI_SERVICE_CONTRACT_VIOLATION', message: 'Kết quả từ AIHUB không đúng định dạng.' } satisfies PublicError
      setResult(payload)
      setStatus('success')
      setStep(3)
      setConsoleStep(3)
      setConsoleTab('interface')
    } catch (caught) {
      const nextError = typeof caught === 'object' && caught !== null && 'code' in caught && 'message' in caught && typeof caught.code === 'string' && typeof caught.message === 'string'
        ? { code: caught.code, message: caught.message }
        : { code: 'AI_SERVICE_TIMEOUT', message: 'Yêu cầu mất quá lâu. Audio vẫn được giữ lại để bạn thử lại.' }
      setError(nextError)
      setStatus('idle')
      setStep(2)
      setConsoleStep(2)
    } finally {
      window.clearTimeout(timeout)
    }
  }

  const reset = () => {
    stopRecorder(true)
    setPart(1)
    setQuery('')
    setQuestionOpen(false)
    setSelectedPrompt(null)
    setHasConfirmedPrompt(false)
    setStep(1)
    clearFile()
    setResult(null)
    setError(null)
    setStatus('idle')
    setRecording(false)
    setRecordingSeconds(0)
    setConsoleStep(1)
    setConsoleTab('response')
  }

  const activePrompt = result
    ? questions.find((prompt) => prompt.id === result.data.question_id) ?? selectedPrompt
    : selectedPrompt

  const requestForStep = (currentStep: Step) => currentStep === 1
    ? 'GET /api/demo/speaking/questions?part=' + part
    : sampleAudioUrl && !file
      ? 'POST /api/demo/speaking/grading-json\n\napplication/json:\n  audio_url: [presigned sample URL]\n  part: ' + (activePrompt?.part ?? part) + '\n  question_id: ' + (activePrompt?.id ?? '—') + '\n  prompt_text: [provided]\n\n// secrets stay server-side'
      : 'POST /api/demo/speaking/grading\n\nform-data:\n  audio: ' + (file?.name ?? '—') + '\n  part: ' + (activePrompt?.part ?? part) + '\n  question_id: ' + (activePrompt?.id ?? '—') + '\n  prompt_text: [provided]\n\n// secrets stay server-side'
  const responsePayload = result ? JSON.stringify(result, null, 2) : JSON.stringify({ state: 'waiting', data: null }, null, 2)
  const copyPayload = () => void navigator.clipboard?.writeText(consoleTab === 'request' ? requestForStep(consoleStep) : responsePayload)
  const calloutEndpoint = consoleStep === 1
    ? 'GET /v1/ielts/speaking/questions?part=' + part
    : sampleAudioUrl && !file
      ? 'POST /v1/ielts/speaking/grading-json'
      : 'POST /v1/ielts/speaking/grading'
  const calloutStatus = consoleStep === 1
    ? 'để tải câu hỏi theo Part.'
    : consoleStep === 2
      ? '[waiting for audio upload/recording]'
      : '[evaluation complete - duration 5.75s]'

  return (
    <main className="aihub-speaking speaking-page">
      <div className="app-shell">
        <div className="app-container">
          <div className="lab-layout">
            <aside className="card setup-card">
              <div className="setup-intro">
                <div className="eyebrow">Các bước tích hợp API</div>
                <h1>IELTS Speaking API Test</h1>
                <p>Demo các bước tích hợp giải pháp AI chấm chữa IELTS Speaking — chọn câu hỏi, đưa câu trả lời qua audio, và nhận phân tích chi tiết bám sát IELTS Band Descriptors.</p>
              </div>

              <StepRow number={1} label="Chọn câu hỏi (Part & Question)" open={step === 1} complete={hasConfirmedPrompt} onClick={() => setStep(1)} />
              {step === 1 && (
                <div className="step-content-content step-content">
                  <label className="mini-label">Part</label>
                  <div className="filter-chips part-selector" role="tablist" aria-label="Speaking parts">
                    {PARTS.map((item) => (
                      <button
                        aria-selected={part === item.value}
                        className={'filter-chip ' + (part === item.value ? 'active' : '')}
                        key={item.value}
                        onClick={() => selectPart(item.value)}
                        role="tab"
                        type="button"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <label className="mini-label question-label" htmlFor="question-select">Question</label>
                  <div className="question-combobox">
                    <Search size={12} className="question-combobox-search" />
                    <input
                      aria-controls="question-options"
                      aria-expanded={questionOpen}
                      className="question-combobox-input"
                      data-testid="select-question"
                      id="question-select"
                      onBlur={() => window.setTimeout(() => setQuestionOpen(false), 120)}
                      onChange={(event) => { setQuery(event.target.value); setQuestionOpen(true) }}
                      onFocus={() => { setQuery(''); setQuestionOpen(true) }}
                      placeholder="Tìm hoặc chọn câu hỏi..."
                      role="combobox"
                      value={questionOpen ? query : selectedPrompt?.question ?? query}
                    />
                    <button
                      aria-label="Mở danh sách câu hỏi"
                      className="question-combobox-toggle"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => setQuestionOpen((open) => !open)}
                      type="button"
                    >
                      <ChevronDown size={12} />
                    </button>
                    {questionOpen && (
                      <div aria-label="Speaking questions" className="question-options" id="question-options" role="listbox">
                        {questionLoadState === 'loading' ? <div className="question-option-empty" role="status">Đang tải câu hỏi...</div> : questionLoadState === 'error' ? <div className="question-option-empty" role="alert">Không tải được câu hỏi từ API.</div> : prompts.length ? prompts.map((prompt) => (
                          <button
                            aria-selected={selectedPrompt?.id === prompt.id}
                            className={'question-option ' + (selectedPrompt?.id === prompt.id ? 'active' : '')}
                            data-testid={'button-question-' + prompt.id}
                            key={prompt.id}
                            onClick={() => selectPrompt(prompt)}
                            onMouseDown={(event) => event.preventDefault()}
                            role="option"
                            type="button"
                          >
                            <span>Part {prompt.part} · {prompt.sampleAudioUrl ? 'Audio mẫu sẵn có' : 'Question'}</span>
                            {prompt.question}
                          </button>
                        )) : <div className="question-option-empty">Không tìm thấy câu hỏi phù hợp.</div>}
                      </div>
                    )}
                  </div>
                  <div className="confirm-actions">
                    <button className="btn btn-primary" data-testid="button-confirm-step-1" disabled={!selectedPrompt} onClick={confirmPrompt} type="button">
                      <Check size={12} /> Confirm Step 1
                    </button>
                    <button className="btn btn-sm" data-testid="button-reset-step-1" onClick={reset} type="button">
                      <RotateCcw size={12} /> Reset Step 1
                    </button>
                  </div>
                </div>
              )}

              <StepRow number={2} label="Đưa câu trả lời (Audio Upload / Record)" open={step === 2} locked={!hasConfirmedPrompt} complete={Boolean(result)} onClick={() => setStep(2)} />
              {step === 2 && hasConfirmedPrompt && (
                <div className="step-content" data-testid="panel-audio-input">
                  <p>Chọn file có sẵn hoặc ghi âm trực tiếp trên trình duyệt. Định dạng hỗ trợ: MP3, WAV, M4A.</p>
                  <div className="audio-box">
                    <strong>{recording ? 'Đang ghi âm câu trả lời' : file || sampleAudioUrl ? 'Đã sẵn sàng để đánh giá' : 'Chưa có audio'}</strong>
                    <p>{recording ? 'Nói tự nhiên, sau đó dừng khi bạn hoàn tất.' : sampleAudioUrl && !file ? 'Audio mẫu được lấy từ AIHUB storage.' : 'Audio tự ghi/tải chỉ được giữ trong bộ nhớ của customer web.'}</p>
                    <div className="btn-row">
                      <button className="btn btn-sm" disabled={recording || status === 'submitting'} onClick={() => fileInputRef.current?.click()} type="button">
                        <UploadCloud size={13} /> Tải file
                      </button>
                      <button className={'btn btn-sm ' + (recording ? 'btn-danger' : 'btn-dark')} disabled={status === 'submitting'} onClick={recording ? stopRecording : startRecording} type="button">
                        {recording ? <Square size={12} fill="currentColor" /> : <Mic size={13} />} {recording ? 'Dừng ghi' : 'Ghi âm'}
                      </button>
                    </div>
                    {recording && <div className="recording-line"><span className="recording-actions"><i className="recording-dot" /> RECORDING</span><span>{String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:{String(recordingSeconds % 60).padStart(2, '0')}</span></div>}
                    {file && !recording && (
                      <div className="recording-line" style={{ color: 'hsl(155 38% 35%)' }}>
                        <span className="recording-actions"><FileAudio size={12} /> {file.name}</span>
                      </div>
                    )}
                    {sampleAudioUrl && !file && <div className="recording-line" style={{ color: 'hsl(155 38% 35%)' }}><span className="recording-actions"><FileAudio size={12} /> Audio mẫu</span></div>}
                    {(previewUrl || sampleAudioUrl) && <audio aria-label="Preview selected audio" className="audio-player" controls src={previewUrl ?? sampleAudioUrl ?? undefined}>Your browser does not support audio playback.</audio>}
                    {error && (
                      <div className="inline-error" role="alert">
                        <strong>{error.code}</strong> {error.message}
                      </div>
                    )}
                    {(file || sampleAudioUrl) && !recording && <button className="btn btn-sm btn-danger" onClick={clearFile} type="button"><RotateCcw size={12} /> Xoá audio</button>}
                  </div>
                  <div className="confirm-actions">
                    <button className="btn btn-primary" data-testid="button-confirm-step-2" disabled={(!file && !sampleAudioUrl) || status === 'submitting'} onClick={submitLive} type="button">
                      {status === 'submitting' ? <Timer size={12} /> : <Terminal size={12} />} {status === 'submitting' ? 'Đang đánh giá...' : 'Confirm Step 2 · Evaluate audio'}
                    </button>
                  </div>
                  <input ref={fileInputRef} accept=".wav,.mp3,.m4a,.webm,.ogg,audio/wav,audio/mpeg,audio/mp4" data-testid="input-audio-file" hidden onChange={(event) => setAudio(event.target.files?.[0] ?? null)} type="file" />
                </div>
              )}

              <StepRow number={3} label="Xem kết quả & Quyết định" open={step === 3} locked={!result} complete={Boolean(result)} onClick={() => setStep(3)} />
              {step === 3 && result && (
                <div className="step-content" data-testid="panel-evaluation-status">
                  <div className="result-mini">
                    <div className="result-mini-top"><CircleCheck size={13} /> Đã phân tích câu trả lời thành công!</div>
                    <p>Kết quả đã sẵn sàng theo response schema của AIHUB.</p>
                    <div className="mini-tags"><span className="mini-tag">Band: {result.data.scorability.display_band ? result.data.estimated_band.overall.toFixed(1) : '—'}</span><span className="mini-tag">Scorable: {result.data.scorability.is_scorable ? 'True' : 'False'}</span><span className="mini-tag">Topic: {Math.round(result.data.relevance.score * 100)}%</span></div>
                  </div>
                  <div className="btn-row" style={{ marginTop: 10 }}>
                    <button className="btn btn-primary" onClick={() => { setConsoleTab('interface'); setStep(3) }} type="button">Tiếp tục (Keep feedback)</button>
                    <button className="btn btn-sm btn-danger" onClick={reset} type="button"><RotateCcw size={12} /> Reset toàn bộ</button>
                  </div>
                </div>
              )}
            </aside>

            <section className="card main-card">
              <div className="main-heading">
                <div>
                  <h2>AIHub Demo — IELTS Speaking <span className="stable-badge">STABLE</span></h2>
                  <p>Chọn câu hỏi IELTS, gửi audio và nhận phân tích phát âm, độ trôi chảy và ngữ pháp từ API AIHub.</p>
                </div>
                <span className="main-status"><Wifi size={11} /> {result ? 'live response' : 'AIHUB gateway'}</span>
              </div>
              <div className="quick-steps" aria-label="Speaking workflow">
                {([1, 2, 3] as const).map((item) => (
                  <button
                    className={'quick-step ' + (consoleStep === item ? 'active' : '')}
                    disabled={(item === 2 && !hasConfirmedPrompt) || (item === 3 && !result)}
                    key={item}
                    onClick={() => { setConsoleStep(item); setStep(item); setConsoleTab(item === 3 ? 'interface' : 'response') }}
                    type="button"
                  >
                    <span>{item}</span>{item === 1 ? 'Chọn câu hỏi' : item === 2 ? 'Đưa câu trả lời' : 'Nhận AI Feedback'}
                  </button>
                ))}
              </div>
              <div className="callout">
                <Info size={13} />
                <span>Gọi <strong>{calloutEndpoint}</strong> {calloutStatus}</span>
              </div>
              <div className="console-tabs" role="tablist" aria-label="Console panels">
                {(result && consoleStep === 3 ? (['interface', 'response', 'request'] as ConsoleTab[]) : (['response', 'request'] as ConsoleTab[])).map((tab) => (
                  <button
                    aria-selected={consoleTab === tab}
                    className={'console-tab ' + (consoleTab === tab ? 'active' : '')}
                    data-testid={'button-console-tab-' + tab}
                    key={tab}
                    onClick={() => setConsoleTab(tab)}
                    role="tab"
                    type="button"
                  >
                    {tab === 'interface' && <Braces size={10} style={{ display: 'inline', marginRight: 4, verticalAlign: '-2px' }} />}
                    {tab === 'interface' ? 'Interface' : tab === 'response' ? 'Response' : 'Request'}
                  </button>
                ))}
              </div>
              <div className="console">
                {consoleTab === 'interface' && (result ? <FeedbackDashboard result={result} /> : <div className="console-empty">{'// Chưa có response — chọn câu hỏi và gửi audio để nhận kết quả.'}</div>)}
                {consoleTab === 'response' && (
                  result ? (
                    <>
                      <div className="console-header"><span><Code2 size={12} /> 200 OK · response body</span><button className="console-copy" onClick={copyPayload} type="button"><Clipboard size={11} /> Copy JSON</button></div>
                      <pre className="json-view">{responsePayload}</pre>
                    </>
                  ) : <div className="console-empty">{'// Chưa gọi API — bấm “Confirm Step 2 · Evaluate audio” ở Bước 2 bên trái để nhận response.'}</div>
                )}
                {consoleTab === 'request' && (
                  <>
                    <div className="console-header"><span><Code2 size={12} /> POST request</span><button className="console-copy" onClick={copyPayload} type="button"><Clipboard size={11} /> Copy JSON</button></div>
                    <pre className="json-view">{requestForStep(consoleStep)}</pre>
                  </>
                )}
              </div>
              {consoleTab === 'interface' && <div className="console-footer"><span><Wifi size={10} style={{ verticalAlign: '-2px', marginRight: 5 }} />{consoleStep === 3 ? 'evaluation complete' : 'waiting for confirmation'}</span><span>request_id <strong>{consoleStep === 3 ? result?.meta.request_id ?? '—' : '—'}</strong></span></div>}
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}
