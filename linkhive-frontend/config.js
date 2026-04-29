window.GRANUM_API_URL = 'http://localhost:3000';
if (!localStorage.getItem('granum_api_url')) {
  localStorage.setItem('granum_api_url', 'http://localhost:3000');
}