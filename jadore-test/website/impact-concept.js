'use strict';
// Demonstration only: no storage, guest identity, reservation, network or payment.
(() => {
  const dialog = document.getElementById('impact-preview');
  if (!dialog) return;
  const open = document.getElementById('impact-preview-open');
  const close = document.getElementById('impact-preview-close');
  const confirm = document.getElementById('impact-demo-confirm');
  const skip = document.getElementById('impact-demo-skip');
  const choices = Array.from(dialog.querySelectorAll('input[name="impact-demo-choice"]'));
  const results = Array.from(dialog.querySelectorAll('[data-impact-result]'));
  const allowed = new Set(['literacy', 'health']);
  const selected = () => choices.find(choice => choice.checked && allowed.has(choice.value));
  const showResult = value => results.forEach(result => { result.hidden = result.dataset.impactResult !== value; });
  const reset = () => {
    choices.forEach(choice => { choice.checked = false; });
    confirm.disabled = true;
    showResult(null);
  };
  open.addEventListener('click', () => { reset(); dialog.showModal(); });
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    // A native close event can be queued until after a rapid reopen.
    if (dialog.open) return;
    reset(); open.focus();
  });
  choices.forEach(choice => choice.addEventListener('change', () => {
    confirm.disabled = !selected();
    showResult(null);
  }));
  confirm.addEventListener('click', () => {
    const choice = selected();
    if (choice) showResult(choice.value);
  });
  skip.addEventListener('click', () => {
    choices.forEach(choice => { choice.checked = false; });
    confirm.disabled = true;
    showResult('skip');
  });
  open.disabled = false;
})();
