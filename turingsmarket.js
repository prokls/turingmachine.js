{
    "title" : "Help",
    "description" : [
        "Hi! This project is all about *turingmachines*. What are turingmachines? They are a computational concept from *Theoretical Computer Science* (TCS) by Alan Turing (*\u20061912 †\u20061954). They illustrate one possible way to define computation and are as powerful as your computer. So how do they work?",
        "Above you can see the animated turing machine with several control elements underneath. The animation consists of a tape (with bright background color) and one cursor (winded green structure). The text at the left bottom of the animation is called *current state*. You can press \"continue\" to compute the next *step*. What are steps?",
        "At the bottom you can see a *transition table*. It defines a current situation, consisting of a read symbol and a state, and the next situation after one step has been performed. So when you press \"continue\" the program will read the focused symbol in the cursor and the current state. It will search for a line in the transition table matching those 2 values and will execute the corresponding result. The result consists of a symbol to write, a movement of the tape and a successor tape.",
        "You can edit the transition table yourself. Try it! 😊"
    ],
    "examples" : [
    ],
    "testcases" : {
        "name": "testsuite 01",
        "max_iterations": 1000,
        "tests" : 
        {
            'name': 'testcase 01',
            'final_states': ['End', 'Final'],
            'tape_default_value': '0',
            'input': {
                'state': 'S0',
                'tape': {
                    'data'
                    'cursor'
                }
            },
            'output': {
                'state': 'S0',
                'final_state_reached': true,
                'tape': {
                    'data'
                    'cursor'
                }
            }
        }
    ]
}


