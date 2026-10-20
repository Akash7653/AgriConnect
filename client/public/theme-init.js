try {
  if (localStorage.getItem('agriconnect-color-mode') === 'dark') {
    document.documentElement.classList.add('dark-mode');
  }
} catch (error) {
  console.warn('Saved color mode could not be read.', error);
}
