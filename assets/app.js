const navigation = document.querySelector('.bottom-nav');
const buttons = [...document.querySelectorAll('.nav-item')];
const panels = [...document.querySelectorAll('.panel')];

navigation.addEventListener('click', (event) => {
  const button = event.target.closest('.nav-item');
  if (!button) return;

  const { target } = button.dataset;
  buttons.forEach((item) => {
    const active = item === button;
    item.classList.toggle('is-active', active);
    active ? item.setAttribute('aria-current', 'page') : item.removeAttribute('aria-current');
  });
  panels.forEach((panel) => { panel.hidden = panel.dataset.panel !== target; });
});
