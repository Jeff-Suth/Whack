# Whack!

- Based on the popular NYT Wordle game comes Whack!
- Instead of using an API to get a new word, just pulls from a list of words kept inside the project.

# Local Testing
- python -m http.server
- http://localhost:8000/
- CTRL + C (Windows) to close the server in the terminal so you can refresh the service with new changes.
- In browser, CTRL + SHIFT + R to force reload.
- Clear user data in browser console using `localStorage.removeItem('yourUsername');`

# TODO
1. Add experience and rank system
2. Add a way to recognize a letter is highlighted and can overwrite it