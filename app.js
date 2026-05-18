const alphabet = [
  { letter: 'A', word: 'Apple' },
  { letter: 'B', word: 'Ball' },
  { letter: 'C', word: 'Cat' },
  { letter: 'D', word: 'Dog' },
  { letter: 'E', word: 'Elephant' },
  { letter: 'F', word: 'Fish' },
  { letter: 'G', word: 'Grapes' },
  { letter: 'H', word: 'Hat' },
  { letter: 'I', word: 'Ice Cream' },
  { letter: 'J', word: 'Jellyfish' },
  { letter: 'K', word: 'Kite' },
  { letter: 'L', word: 'Lion' },
  { letter: 'M', word: 'Monkey' },
  { letter: 'N', word: 'Nose' },
  { letter: 'O', word: 'Orange' },
  { letter: 'P', word: 'Penguin' },
  { letter: 'Q', word: 'Queen' },
  { letter: 'R', word: 'Rabbit' },
  { letter: 'S', word: 'Sun' },
  { letter: 'T', word: 'Tree' },
  { letter: 'U', word: 'Umbrella' },
  { letter: 'V', word: 'Violin' },
  { letter: 'W', word: 'Watermelon' },
  { letter: 'X', word: 'Xylophone' },
  { letter: 'Y', word: 'Yarn' },
  { letter: 'Z', word: 'Zebra' },
]

let currentIndex = 0

const letterEl = document.getElementById('letter')
const wordEl = document.getElementById('word')
const prevBtn = document.getElementById('prevBtn')
const nextBtn = document.getElementById('nextBtn')
const gridEl = document.getElementById('letterGrid')

function renderLetter(index) {
  const item = alphabet[index]
  letterEl.textContent = item.letter
  wordEl.textContent = item.word
  updateGrid(index)
}

function updateGrid(activeIndex) {
  gridEl.innerHTML = ''
  alphabet.forEach((item, i) => {
    const div = document.createElement('div')
    div.className = 'grid-letter' + (i === activeIndex ? ' active' : '')
    div.textContent = item.letter
    div.addEventListener('click', () => {
      currentIndex = i
      renderLetter(currentIndex)
    })
    gridEl.appendChild(div)
  })
}

prevBtn.addEventListener('click', () => {
  currentIndex = (currentIndex - 1 + alphabet.length) % alphabet.length
  renderLetter(currentIndex)
})

nextBtn.addEventListener('click', () => {
  currentIndex = (currentIndex + 1) % alphabet.length
  renderLetter(currentIndex)
})

// keyboard support
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') prevBtn.click()
  if (e.key === 'ArrowRight') nextBtn.click()
})

// init
renderLetter(0)
