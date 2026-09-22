/* MPowa prototype interface — module selection + mocked agent-check pipeline. */
(function () {
  'use strict';

  var MODULES = {
    'gold-law': { label: 'Gold Law', placeholder: 'Ask MPowa about Gold Law compliance…' },
    'gdpr': { label: 'GDPR Compliance', placeholder: 'Ask MPowa about GDPR compliance…' },
    'fca': { label: 'FCA Rule Breaker', placeholder: 'Ask MPowa to flag an FCA rule breach…' },
    'sec': { label: 'SEC Compliance', placeholder: 'Ask MPowa about SEC compliance…' }
  };

  var STEP_ORDER = ['regulatory', 'bias', 'provenance', 'audit', 'verdict'];
  var STEP_DELAY_MS = 650;

  var activeModule = 'gold-law';
  var runTimers = [];

  var moduleButtons = Array.prototype.slice.call(document.querySelectorAll('.mp-module[data-module]'));
  var searchForm = document.getElementById('mpSearchForm');
  var searchInput = document.getElementById('mpSearchInput');
  var resetBtn = document.getElementById('mpResetBtn');
  var agentStatus = document.getElementById('mpAgentStatus');
  var stepEls = Array.prototype.slice.call(document.querySelectorAll('.mp-agent-step'));

  function setActiveModule(moduleId) {
    if (!MODULES[moduleId]) return;
    activeModule = moduleId;

    moduleButtons.forEach(function (btn) {
      var isActive = btn.getAttribute('data-module') === moduleId;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
    });

    if (searchInput) {
      searchInput.placeholder = MODULES[moduleId].placeholder;
    }
  }

  function clearRunTimers() {
    runTimers.forEach(function (t) { window.clearTimeout(t); });
    runTimers = [];
  }

  function setStepState(stepName, state) {
    var el = stepEls.filter(function (s) { return s.getAttribute('data-step') === stepName; })[0];
    if (!el) return;
    el.classList.remove('is-idle', 'is-running', 'is-pass');
    el.classList.add('is-' + state);
    var stateLabel = el.querySelector('.mp-step-state');
    if (stateLabel) {
      stateLabel.textContent = state === 'running' ? 'Checking…' : state === 'pass' ? 'Passed' : 'Idle';
    }
  }

  function resetSteps() {
    clearRunTimers();
    STEP_ORDER.forEach(function (step) { setStepState(step, 'idle'); });
    if (agentStatus) {
      agentStatus.textContent = 'Standing by — select a module and ask a question';
    }
  }

  function runAgentChecks(query) {
    clearRunTimers();
    var moduleLabel = MODULES[activeModule].label;

    if (agentStatus) {
      agentStatus.textContent = query
        ? 'Verifying "' + query + '" against ' + moduleLabel + '…'
        : 'Verifying against ' + moduleLabel + '…';
    }

    STEP_ORDER.forEach(function (step) { setStepState(step, 'idle'); });

    STEP_ORDER.forEach(function (step, i) {
      runTimers.push(window.setTimeout(function () {
        setStepState(step, 'running');
      }, i * STEP_DELAY_MS));

      runTimers.push(window.setTimeout(function () {
        setStepState(step, 'pass');
        if (step === 'verdict' && agentStatus) {
          agentStatus.textContent = '5/5 checks passed — mocked verdict for ' + moduleLabel;
        }
      }, i * STEP_DELAY_MS + STEP_DELAY_MS - 150));
    });
  }

  moduleButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      setActiveModule(btn.getAttribute('data-module'));
      resetSteps();
    });
  });

  if (searchForm) {
    searchForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var query = searchInput ? searchInput.value.trim() : '';
      runAgentChecks(query);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      if (searchInput) searchInput.value = '';
      resetSteps();
    });
  }

  setActiveModule(activeModule);
})();
