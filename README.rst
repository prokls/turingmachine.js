turingmachine.js
================

:release:   0.5.0-tutors
:date:      October 2013
:status:    major tasks are stable
:author:    meisterluk
:license:   Public Domain

A turingmachine for educational purposes.

Roadmap
-------

0.6.0 release
~~~~~~~~~~~~~

* Support strings for tape imports
* Rename "input" to "fromJSON"
* Rename Tape to SimpleTape
* history has to store states as well
* possibility to set final states
* exhaustive testing of import & export
* publish solution for 4-bit addition
* possibility to set the cursor in the tape
* representation of space as 'x'
* reconsider design of reset button

0.8.0 release
~~~~~~~~~~~~~

* tape *always* trims default values
* simplify history in export, but don't break it
* Implementation of history size

1.0.0 release
~~~~~~~~~~~~~

* Strict decoupling of UI and program through VM commands
* Reconsider design of RecordedTape and history
* Animations instead of state drawings
* Speed option enabled
* Basic Interaction with canvas
* JFLAP export

1.4.0 release
~~~~~~~~~~~~~

* Instruction graph with springy.js

1.8.0 release
~~~~~~~~~~~~~

* Major features in interaction with HTML5 canvas

cheers,
meisterluk
