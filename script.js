/**
 * SPDX-License-Identifier: Apache-2.0
 */

import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.es.mjs';
// import { marked } from 'https://cdn.jsdelivr.net/npm/marked@13.0.3/lib/marked.esm.js';

(async () => {
  const showNotSupportedMessage = () => {
    document.querySelector('.not-supported-message').hidden = false;
  };

  if (!('Writer' in self)) { // Require Writer (Rewriter used if available)
    return showNotSupportedMessage();
  }

  const writeForm = document.querySelector('.write-form');
  const rewriteForm = document.querySelector('.rewrite-form');
  const contextInput = document.querySelector('input');
  const copyButton = document.querySelector('.copy-button');
  const output = document.querySelector('output');
  const textarea = document.querySelector('textarea');
  const formatSelect = document.querySelector('.format');
  const toneSelect = document.querySelector('.tone');
  const lengthSelect = document.querySelector('.length');
  const wordCountEl = document.querySelector('.word-count');
  const randomizeButton = document.querySelector('.randomize-button');
  const rewriteFormatSelect = document.querySelector('.rewrite-format');
  const rewriteToneSelect = document.querySelector('.rewrite-tone');
  const rewriteLengthSelect = document.querySelector('.rewrite-length');

  writeForm.hidden = false;

  let writer;
  let rewriter;

  const toWords = (text) => {
    // split on commas or whitespace, strip punctuation
    return text
      .split(/[\s,]+/)
      .map(w => w.trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
      .filter(Boolean);
  };

  const updateWordCount = () => {
    const words = toWords(textarea.value);
    wordCountEl.textContent = String(words.length);
  };

  const SAMPLE_WORDS = [
    'river','lantern','magnet','sapphire','canyon','violin','comet','orchard','whisper','atlas','neon','quartz',
    'ember','harbor','parchment','copper','willow','thunder','glacier','compass','nebula','loom','ginger','tunnel',
    'carousel','harvest','pixel','cipher','velvet','marble','photon','grove','plume','delta','garnet','meadow'
  ];

  const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  const randomizeWords = () => {
    const target = randomInt(12, 24);
    const pool = [...SAMPLE_WORDS];
    const picked = [];
    while (picked.length < target && pool.length) {
      const i = randomInt(0, pool.length - 1);
      picked.push(pool.splice(i, 1)[0]);
    }
    textarea.value = picked.join(', ');
    updateWordCount();
  };

  textarea.addEventListener('input', updateWordCount);
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      writeForm.dispatchEvent(new Event('submit'));
    }
  });
  [contextInput, textarea].forEach((input) =>
    input.addEventListener('focus', () => {
      input.select();
    })
  );
  randomizeButton.addEventListener('click', randomizeWords);
  updateWordCount();

  const createWriter = async () => {
    const options = {
      tone: toneSelect?.value || 'neutral',
      length: lengthSelect?.value || 'short',
      format: formatSelect?.value || 'markdown',
      sharedContext: contextInput.value.trim(),
    };
    writer = await Writer.create(options);
  };

  const createRewriter = async () => {
    if (!('Rewriter' in self)) return; // graceful degrade
    const options = {
      tone: rewriteToneSelect?.value || 'as-is',
      length: rewriteLengthSelect?.value || 'as-is',
      format: rewriteFormatSelect?.value || 'as-is',
      sharedContext: contextInput.value.trim(),
    };
    rewriter = await Rewriter.create(options);
  };

  const buildPrompt = () => {
    const words = toWords(textarea.value);
    const style = contextInput.value.trim();
    const list = words.join(', ');
    const styleLine = style ? `Style: ${style}.` : '';
    return `You are a creative writing assistant for memory training.
Use all of the following words naturally in a coherent story to help user remember them: ${list}.
Requirements:
- Bold each word the first time it appears (use **bold**).
- 5–8 sentences. Max 250 words.
- Make it vivid and easy to remember.
${styleLine}`;
  };

  const write = async () => {
    output.style.display = 'block';
    copyButton.hidden = true;
    if (rewriteForm) rewriteForm.hidden = true;
    const words = toWords(textarea.value);
    if (words.length < 12 || words.length > 24) {
      output.textContent = 'Please enter between 12 and 24 words (separated by spaces or commas).';
      output.style.display = 'block';
      return;
    }
    output.textContent = 'Generating story…';
    const prompt = buildPrompt();
    const stream = writer.writeStreaming(prompt);
    output.textContent = '';
    let fullResponse = '';
    for await (const chunk of stream) {
      fullResponse = 'Writer' in self ? fullResponse + chunk : chunk;
      output.innerHTML = DOMPurify.sanitize(fullResponse);
    }
    copyButton.hidden = false;
    if ('Rewriter' in self && rewriteForm) {
      rewriteForm.hidden = false;
    }
  };

  writeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await createWriter();
    await write();
  });

  copyButton.addEventListener('click', async () => {
    await navigator.clipboard.writeText(output.innerText);
  });

  // Rewrite functionality (tone/length)
  const rewrite = async () => {
    if (!('Rewriter' in self) || !rewriteForm) return;
    rewriteForm.hidden = true;
    copyButton.hidden = true;
    const prompt = output.innerHTML.trim();
    if (!prompt) {
      return;
    }
    output.textContent = 'Rewriting…';
    const stream = await rewriter.rewriteStreaming(prompt);
    output.textContent = '';
    let fullResponse = '';
    for await (const chunk of stream) {
      fullResponse = 'Rewriter' in self ? fullResponse + chunk : chunk;
      output.innerHTML = DOMPurify.sanitize(fullResponse);
    }
    rewriteForm.hidden = false;
    copyButton.hidden = false;
    [rewriteToneSelect, rewriteLengthSelect, rewriteFormatSelect].forEach(
      (select) => select && (select.value = 'as-is')
    );
  };

  if (rewriteForm) {
    rewriteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await createRewriter();
      await rewrite();
    });

    // Remove once multiple rewrite options are supported.
    const whatTone = document.querySelector('[name=what][value=tone]');
    const whatLength = document.querySelector('[name=what][value=length]');

    [whatTone, whatLength].forEach((what) => {
      what?.addEventListener('change', () => {
        if (rewriteToneSelect?.labels?.[0]) rewriteToneSelect.labels[0].hidden = !whatTone.checked;
        if (rewriteLengthSelect?.labels?.[0]) rewriteLengthSelect.labels[0].hidden = !whatLength.checked;
        if (rewriteFormatSelect?.labels?.[0]) rewriteFormatSelect.labels[0].hidden = true;
      });
    });
    if (rewriteToneSelect?.labels?.[0]) rewriteToneSelect.labels[0].hidden = false; // default tone
    if (rewriteLengthSelect?.labels?.[0]) rewriteLengthSelect.labels[0].hidden = true; // length off by default
    if (!('Rewriter' in self)) {
      // If Rewriter not available, keep the form hidden.
      rewriteForm.hidden = true;
    }
  }
})();
