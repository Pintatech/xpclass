# Test Bulk Import for Smart Drag Drop Editor

## Test Data

```
Q: Complete the sentence by dragging the correct words
Hello [my] [name] [is] John
Distractors: wrong, incorrect, false

1. Fill in the missing words in order
The capital of [France] [is] [Paris]
Distractors: Germany, London, Italy

2: Put the words in the correct sequence
She [has] [been] [studying] English for 3 years

Question: Complete the phrase
I [love] [learning] [new] things
```

## Expected Results

1. Should create 4 drag & drop questions
2. First question should have dragable items: "my", "name", "is" + distractors: "wrong", "incorrect", "false"
3. Second question should have dragable items: "France", "is", "Paris" + distractors: "Germany", "London", "Italy"
4. Third question should have dragable items: "has", "been", "studying"
5. Fourth question should have dragable items: "love", "learning", "new"

## How to Test

1. Open http://localhost:3002 in browser
2. Navigate to Exercise Bank or create new exercise
3. Select "Drag & Drop" exercise type
4. Click "Bulk Import" button
5. Paste the test data above
6. Click "Import Questions"
7. Verify questions are created correctly
8. Test the "Export" button to see if it generates proper format