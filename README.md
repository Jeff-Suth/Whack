# Whack!

- Based on the popular NYT Wordle game comes Whack!
- Instead of using an API to get a new word, just pulls from a list of words kept inside the project.

# Local Testing
- python -m http.server
- http://localhost:8000/
- CTRL + C (Windows) to close the server in the terminal so you can refresh the service with new changes.
- In browser, CTRL + SHIFT + R to force reload.

# TODO
1. Add in local profile for individual user
2. Add experience and rank system
3. Add in letter highlighting based on guess
4. Add more words into list, like latte
5. Add a way to recognize a letter is highlighted and can overwrite it
6. Don't let user guess the same thing twice! (store guesses in an array and check against that as well before allowing guess)