import { PERSONA_IDS } from './ai-personas.js';

const noExtra = { additionalProperties: false };

export const STUDY_MANIFEST_SCHEMA = Object.freeze({
  type: 'object',
  ...noExtra,
  properties: {
    activity: { type: 'string', enum: ['coding', 'recall', 'brainstorm', 'reading', 'conversation'] },
    scene: {
      type: 'object',
      ...noExtra,
      properties: {
        engine_id: { type: 'string', enum: ['code_workbench', 'recall_deck', 'idea_canvas', 'focus_reader', 'dialogue_stage'] },
        environment: { type: 'string' },
        components: {
          type: 'array',
          minItems: 1,
          maxItems: 10,
          items: { type: 'string', enum: ['code_editor', 'static_terminal', 'mission_board', 'recall_card', 'recall_draft', 'memory_map', 'idea_nodes', 'reader_document', 'field_notes', 'dialogue_choices'] },
        },
      },
      required: ['engine_id', 'environment', 'components'],
    },
    interactions: {
      type: 'array',
      minItems: 1,
      maxItems: 3,
      items: { type: 'string', enum: ['hint', 'quiz', 'reply'] },
    },
    persona_id: { type: 'string', enum: PERSONA_IDS },
    capabilities: {
      type: 'object',
      ...noExtra,
      properties: {
        code_editor: { type: 'boolean' },
        terminal: { type: 'boolean' },
        timer_type: { type: 'string', enum: ['none', 'pomodoro', 'feynman_pomodoro'] },
        bgm_recommendation: { type: 'string', enum: ['none', 'quiet_focus', 'lofi_cyber'] },
      },
      required: ['code_editor', 'terminal', 'timer_type', 'bgm_recommendation'],
    },
    rationale: { type: 'string' },
  },
  required: ['activity', 'scene', 'interactions', 'persona_id', 'capabilities', 'rationale'],
});

// Backward-compatible export name for internal imports during the protocol transition.
export const INTENT_SCHEMA = STUDY_MANIFEST_SCHEMA;

export const ACTION_SCHEMAS = Object.freeze({
  flashcards: {
    name: 'study_flashcards',
    schema: {
      type: 'object', ...noExtra,
      properties: {
        cards: {
          type: 'array', minItems: 3, maxItems: 8,
          items: {
            type: 'object', ...noExtra,
            properties: {
              question: { type: 'string' },
              answer: { type: 'string' },
              hint: { type: 'string' },
            },
            required: ['question', 'answer', 'hint'],
          },
        },
      },
      required: ['cards'],
    },
  },
  summary: {
    name: 'study_summary',
    schema: {
      type: 'object', ...noExtra,
      properties: {
        lines: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'string' } },
        key_terms: { type: 'array', minItems: 0, maxItems: 6, items: { type: 'string' } },
      },
      required: ['lines', 'key_terms'],
    },
  },
  node_suggestion: {
    name: 'study_node_suggestion',
    schema: {
      type: 'object', ...noExtra,
      properties: {
        title: { type: 'string' },
        text: { type: 'string' },
        rationale: { type: 'string' },
      },
      required: ['title', 'text', 'rationale'],
    },
  },
  code_review: {
    name: 'study_code_review',
    schema: {
      type: 'object', ...noExtra,
      properties: {
        headline: { type: 'string' },
        complexity: { type: 'string' },
        questions: { type: 'array', minItems: 1, maxItems: 4, items: { type: 'string' } },
        hints: { type: 'array', minItems: 1, maxItems: 4, items: { type: 'string' } },
        risks: { type: 'array', minItems: 0, maxItems: 4, items: { type: 'string' } },
      },
      required: ['headline', 'complexity', 'questions', 'hints', 'risks'],
    },
  },
  paragraph_explain: {
    name: 'study_paragraph_explain',
    schema: {
      type: 'object', ...noExtra,
      properties: {
        explanation: { type: 'string' },
        evidence: { type: 'string' },
        check_question: { type: 'string' },
      },
      required: ['explanation', 'evidence', 'check_question'],
    },
  },
  pdf_extract: {
    name: 'study_pdf_extract',
    schema: {
      type: 'object', ...noExtra,
      properties: {
        title: { type: 'string' },
        sections: { type: 'array', minItems: 1, maxItems: 20, items: { type: 'string' } },
      },
      required: ['title', 'sections'],
    },
  },
});
