// Init constant variables for word display and keyboard...this is based on the HTML/CSS naming
const tileDisplay = document.querySelector('.tile-container')
const keyboard = document.querySelector('.key-container')
const messageDisplay = document.querySelector('.message-container')

// ??? Example test word, will be pulling from a randomly made word list later
//const whack = 'WHACK'

let whack

const getWhack = () => {
    fetch('http://localhost:8000/word')
        .then(response => response.json())
        .then(json => {
            console.log(json)
            whack = json.toUpperCase()
        })
        .catch(err => console.log(err))
}
getWhack()

const keys = [
    'Q',
    'W',
    'E',
    'R',
    'T',
    'Y',
    'U',
    'I',
    'O',
    'P',
    'A',
    'S',
    'D',
    'F',
    'G',
    'H',
    'J',
    'K',
    'L',
    'ENTER',
    'Z',
    'X',
    'C',
    'V',
    'B',
    'N',
    'M',
    '«',
]

// Right now allowing 6 guesses
const guessRows = [
    ['', '', '', '', ''],
    ['', '', '', '', ''],
    ['', '', '', '', ''],
    ['', '', '', '', ''],
    ['', '', '', '', ''],
    ['', '', '', '', '']
]
// init let variables
let currentRow = 0
let currentTile = 0
let isGameOver = false

guessRows.forEach((guessRow,guessRowIndex) => {
    const rowElement = document.createElement('div')
    rowElement.setAttribute('id', 'guessRow-' + guessRowIndex)
    guessRow.forEach((guess, guessIndex) => {
        const tileElement = document.createElement('div')
        tileElement.setAttribute('id','guessRow-' + guessRowIndex + '-tile-' + guessIndex)
        tileElement.classList.add('tile')
        rowElement.append(tileElement)
    })
    tileDisplay.append(rowElement)
})

keys.forEach(key => {
    const buttonElement = document.createElement('button')
    buttonElement.textContent = key
    buttonElement.setAttribute('id', key)
    buttonElement.addEventListener('click', () => handleClick(key))
    keyboard.append(buttonElement)
})

const handleClick = (key) => {
    if (!isGameOver){
        console.log('clicked', key)
        // Delete last key function
        if (key === '«') {
            deleteLetter()
            console.log('guessRows',guessRows)
            return
        }
        // Enter word function
        if (key === 'ENTER') {
            console.log('check row')
            console.log('guessRows',guessRows)
            checkRow()
            return
        }
        // Hint Function
        // Next Word function
        //Add letter to guess function
        addLetter(key)
    }

}

const addLetter = (key) => {
    if (currentTile < 5 && currentRow < 6) {
        // init tile variable based on currentRow and currentTile variables...
        const tile = document.getElementById('guessRow-' + currentRow + '-tile-' + currentTile)
        tile.textContent = key
        guessRows[currentRow][currentTile] = key
        tile.setAttribute('data', key)
        currentTile++
        console.log('guessRows',guessRows)
    }
}

const deleteLetter = () => {
    if (currentTile > 0) {
        currentTile--
        const tile = document.getElementById('guessRow-' + currentRow + '-tile-' + currentTile)
        tile.textContent = ''
        guessRows[currentRow][currentTile] = ''
        tile.setAttribute('data','')
    }
}

// Enter function
const checkRow = () => {
    //const row = document.getElementById('guessRow-' + currentRow)
    const guess = guessRows[currentRow].join('')
    if (currentTile <= 4) {
        //shake row
        showMessage('Not enough letters!')
    } else if (currentTile > 4) {
        fetch(`http://localhost:8000/check/?word=${guess}`)
            .then(response => response.json())
            .then(json => {
                console.log(json)
                if (json == 'Entry word not found'){
                    showMessage(guess + ' is not in the word list!')
                } else {
                    console.log('guess is ' + guess + ' the whack is ' + whack)
                    flipTile()
                    if (guess == whack) {
                        // Have variable of username to personally congratulate them
                        // Delay message shown
                        setTimeout(() => showMessage('Great job Chi!'), 2500)
                        isGameOver = true
                    } else {
                        if (currentRow >= 5) {
                            isGameOver = true
                            setTimeout(() => showMessage('Game Over...that was a tough one...'), 2500)
                            return
                        }
                        if (currentRow < 5) {
                            currentRow++
                            currentTile = 0
                        }
                    }
                }
            }).catch(err => console.log(err))
    }

}

const showMessage = (message) => {
    const messageElement = document.createElement('p')
    messageElement.textContent = message
    messageDisplay.append(messageElement)
    setTimeout(() => messageDisplay.removeChild(messageElement), 2500)
}

const addColorToKey = (keyLetter, style) => {
    const key = document.getElementById(keyLetter)
    key.classList.add(style)
}

const flipTile = () => {
    const rowTiles = document.querySelector('#guessRow-' + currentRow).childNodes
    rowTiles.forEach((tile, index) => {
        const dataLetter = tile.getAttribute('data')

        setTimeout(() => {
            tile.classList.add('flip')
            if (dataLetter === whack[index]) {
                tile.classList.add('green-overlay')
                addColorToKey(dataLetter, 'green-overlay')
            } else if (whack.includes(dataLetter)) {
                tile.classList.add('yellow-overlay')
                addColorToKey(dataLetter, 'yellow-overlay')
            } else {
                tile.classList.add('gray-overlay')
                addColorToKey(dataLetter, 'gray-overlay')
            }
        }, 500 * index)
        })
}


