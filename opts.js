const keyInput = document.getElementById('apiKeyInput');

browser.storage.local.get('chatGptKey')
  .then(storage => keyInput.value = storage?.chatGptKey ?? '');

const functions = {
  saveKeyBtn() {
    browser.storage.local.set({ 'chatGptKey': keyInput.value.trim() });
    keyInput.classList.toggle('bg-ok');
    keyInput.type = 'password';
    setTimeout(() => keyInput.classList.toggle('bg-ok'), 5000);
  },
  resetKeyBtn() {
    keyInput.value = '';
    browser.storage.local.remove('chatGptKey');
  },
  toggleKeyBtn: function () {
    this.type = this.type === 'password' ? 'text' : 'password';
  }.bind(keyInput),
};

Object.entries(functions).forEach(([name, func]) => {
  document.getElementById(name).addEventListener('click', func);
});
