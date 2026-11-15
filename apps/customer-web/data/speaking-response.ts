export type SpeakingGradingData = {
  test_type?: string | null
  question_id: string
  scorability: {
    is_scorable: boolean
    confidence: string
    display_band: boolean
    message_vi: string | null
  }
  estimated_band: {
    overall: number
    fluency_coherence: number
    lexical_resource: number
    grammatical_range_accuracy: number
    pronunciation: number
  }
  transcript: {
    text: string
    word_count: number
    duration_seconds: number
  }
  relevance: {
    on_topic: boolean
    score: number
    feedback_vi: string | null
  }
  fluency_metrics: {
    speech_rate_wpm: number | null
    pause_count: number | null
    mean_length_run_words: number | null
  } | null
  pronunciation_detail: {
    summary: {
      good_count: number
      fair_count: number
      poor_count: number
    }
    words: Array<{
      word: string
      quality_score: number
      quality_class: string
      syllables: Array<{
        letters: string
        stress_level: number | null
        predicted_stress: number
        stress_score: number
        quality_score: number
        audio_extent_ms: [number, number]
      }>
      phonemes: Array<{
        phone: string
        quality_score: number
        sound_most_like: string
        stress_level: number | null
        audio_extent_ms: [number, number]
        char_index: number[]
      }>
    }>
  }
  language_analysis: {
    grammar_errors: Array<{
      sentence: string
      error_segment: string
      correction: string
      error_type: string
      explanation_vi: string
    }>
    vocabulary_upgrades: Array<{
      original_word: string
      suggested_word: string
      cefr_level: string
      context?: string
      reason_vi: string
    }>
  }
  feedback: {
    summary_vi: string
    strong_point_vi: string
    action_plan_vi: string
  }
}

export type SpeakingGradingEnvelope = {
  data: SpeakingGradingData
  meta: {
    request_id: string
    correlation_id?: string
    service?: string
    operation?: string
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNonNegativeNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0
}

function isBand(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 9 && Number.isInteger(value * 2)
}

function isScore(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 100
}

function isStress(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 2)
}

function isExtent(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((item) => typeof item === 'number' && Number.isInteger(item) && item >= 0)
  )
}

function parseData(value: unknown): SpeakingGradingData | null {
  if (!isRecord(value)) return null
  const scorability = value.scorability
  const band = value.estimated_band
  const transcript = value.transcript
  const relevance = value.relevance
  const fluency = value.fluency_metrics
  const pronunciation = value.pronunciation_detail
  const language = value.language_analysis
  const feedback = value.feedback

  if (
    typeof value.question_id !== 'string' ||
    !value.question_id.trim() ||
    (value.test_type !== undefined &&
      value.test_type !== null &&
      typeof value.test_type !== 'string') ||
    !isRecord(scorability) ||
    typeof scorability.is_scorable !== 'boolean' ||
    typeof scorability.confidence !== 'string' ||
    typeof scorability.display_band !== 'boolean' ||
    (scorability.message_vi !== null && typeof scorability.message_vi !== 'string') ||
    !isRecord(band) ||
    !isBand(band.overall) ||
    !isBand(band.fluency_coherence) ||
    !isBand(band.lexical_resource) ||
    !isBand(band.grammatical_range_accuracy) ||
    !isBand(band.pronunciation) ||
    !isRecord(transcript) ||
    typeof transcript.text !== 'string' ||
    !Number.isInteger(transcript.word_count) ||
    (typeof transcript.word_count !== 'number' || transcript.word_count < 0) ||
    !isNonNegativeNumber(transcript.duration_seconds) ||
    !isRecord(relevance) ||
    typeof relevance.on_topic !== 'boolean' ||
    !isFiniteNumber(relevance.score) ||
    (typeof relevance.score !== 'number' || relevance.score < 0 || relevance.score > 1) ||
    (relevance.feedback_vi !== null && typeof relevance.feedback_vi !== 'string')
  ) {
    return null
  }

  if (
    fluency !== null &&
    (!isRecord(fluency) ||
      ![fluency.speech_rate_wpm, fluency.pause_count, fluency.mean_length_run_words].every(
        (item) => item === null || isNonNegativeNumber(item),
      ) ||
      (fluency.pause_count !== null && !Number.isInteger(fluency.pause_count)))
  ) {
    return null
  }

  if (!isRecord(pronunciation) || !isRecord(pronunciation.summary) || !Array.isArray(pronunciation.words)) {
    return null
  }
  const summary = pronunciation.summary
  if (![summary.good_count, summary.fair_count, summary.poor_count].every(
    (item) => typeof item === 'number' && Number.isInteger(item) && item >= 0,
  )) return null
  const words = pronunciation.words.map((word) => {
    if (!isRecord(word) || typeof word.word !== 'string' || !isScore(word.quality_score) || typeof word.quality_class !== 'string' || !Array.isArray(word.syllables) || !Array.isArray(word.phonemes)) return null
    const syllables = word.syllables.map((syllable) => {
      if (!isRecord(syllable) || typeof syllable.letters !== 'string' || !isStress(syllable.stress_level) || typeof syllable.predicted_stress !== 'number' || !Number.isInteger(syllable.predicted_stress) || syllable.predicted_stress < 0 || syllable.predicted_stress > 2 || !isScore(syllable.stress_score) || !isScore(syllable.quality_score) || !isExtent(syllable.audio_extent_ms)) return null
      return {
        letters: syllable.letters,
        stress_level: syllable.stress_level,
        predicted_stress: syllable.predicted_stress,
        stress_score: syllable.stress_score,
        quality_score: syllable.quality_score,
        audio_extent_ms: syllable.audio_extent_ms,
      }
    })
    const phonemes = word.phonemes.map((phoneme) => {
      if (!isRecord(phoneme) || typeof phoneme.phone !== 'string' || !isScore(phoneme.quality_score) || typeof phoneme.sound_most_like !== 'string' || !isStress(phoneme.stress_level) || !isExtent(phoneme.audio_extent_ms) || !Array.isArray(phoneme.char_index) || !phoneme.char_index.every((item) => typeof item === 'number' && Number.isInteger(item) && item >= 0)) return null
      return {
        phone: phoneme.phone,
        quality_score: phoneme.quality_score,
        sound_most_like: phoneme.sound_most_like,
        stress_level: phoneme.stress_level,
        audio_extent_ms: phoneme.audio_extent_ms,
        char_index: phoneme.char_index,
      }
    })
    if (syllables.some((item) => item === null) || phonemes.some((item) => item === null)) return null
    return {
      word: word.word,
      quality_score: word.quality_score,
      quality_class: word.quality_class,
      syllables: syllables as SpeakingGradingData['pronunciation_detail']['words'][number]['syllables'],
      phonemes: phonemes as SpeakingGradingData['pronunciation_detail']['words'][number]['phonemes'],
    }
  })
  if (words.some((item) => item === null)) return null

  if (!isRecord(language) || !Array.isArray(language.grammar_errors) || !Array.isArray(language.vocabulary_upgrades)) return null
  const grammarErrors = language.grammar_errors.map((item) => {
    if (!isRecord(item) || !['sentence', 'error_segment', 'correction', 'error_type', 'explanation_vi'].every((key) => typeof item[key] === 'string')) return null
    return item as SpeakingGradingData['language_analysis']['grammar_errors'][number]
  })
  const vocabularyUpgrades = language.vocabulary_upgrades.map((item) => {
    if (!isRecord(item) || !['original_word', 'suggested_word', 'cefr_level', 'reason_vi'].every((key) => typeof item[key] === 'string') || (item.context !== undefined && typeof item.context !== 'string')) return null
    return item as SpeakingGradingData['language_analysis']['vocabulary_upgrades'][number]
  })
  if (grammarErrors.some((item) => item === null) || vocabularyUpgrades.some((item) => item === null)) return null

  if (!isRecord(feedback) || !['summary_vi', 'strong_point_vi', 'action_plan_vi'].every((key) => typeof feedback[key] === 'string')) return null

  return {
    test_type: value.test_type as string | null | undefined,
    question_id: value.question_id,
    scorability: {
      is_scorable: scorability.is_scorable,
      confidence: scorability.confidence,
      display_band: scorability.display_band,
      message_vi: scorability.message_vi as string | null,
    },
    estimated_band: {
      overall: band.overall,
      fluency_coherence: band.fluency_coherence,
      lexical_resource: band.lexical_resource,
      grammatical_range_accuracy: band.grammatical_range_accuracy,
      pronunciation: band.pronunciation,
    },
    transcript: {
      text: transcript.text,
      word_count: transcript.word_count,
      duration_seconds: transcript.duration_seconds,
    },
    relevance: {
      on_topic: relevance.on_topic,
      score: relevance.score,
      feedback_vi: relevance.feedback_vi as string | null,
    },
    fluency_metrics: fluency as SpeakingGradingData['fluency_metrics'],
    pronunciation_detail: {
      summary: {
        good_count: summary.good_count as number,
        fair_count: summary.fair_count as number,
        poor_count: summary.poor_count as number,
      },
      words: words as SpeakingGradingData['pronunciation_detail']['words'],
    },
    language_analysis: {
      grammar_errors: grammarErrors as SpeakingGradingData['language_analysis']['grammar_errors'],
      vocabulary_upgrades: vocabularyUpgrades as SpeakingGradingData['language_analysis']['vocabulary_upgrades'],
    },
    feedback: {
      summary_vi: feedback.summary_vi as string,
      strong_point_vi: feedback.strong_point_vi as string,
      action_plan_vi: feedback.action_plan_vi as string,
    },
  }
}

export function parseSpeakingGradingEnvelope(input: unknown): SpeakingGradingEnvelope | null {
  if (!isRecord(input) || !isRecord(input.meta) || typeof input.meta.request_id !== 'string') return null
  const data = parseData(input.data)
  if (!data) return null
  return {
    data,
    meta: {
      request_id: input.meta.request_id,
      correlation_id: typeof input.meta.correlation_id === 'string' ? input.meta.correlation_id : undefined,
      service: typeof input.meta.service === 'string' ? input.meta.service : undefined,
      operation: typeof input.meta.operation === 'string' ? input.meta.operation : undefined,
    },
  }
}

export function isSpeakingGradingEnvelope(input: unknown): input is SpeakingGradingEnvelope {
  return parseSpeakingGradingEnvelope(input) !== null
}
