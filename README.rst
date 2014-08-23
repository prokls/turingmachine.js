turingmachine.js
================

:release:   0.5.0-tutors
:date:      October 2013 - August 2014
:status:    major tasks are stable
:author:    meisterluk
:license:   CC0

A turingmachine for educational purposes.

Roadmap
-------

0.6.0 release
~~~~~~~~~~~~~

* [done] Support strings for tape imports
* [done] Rename "input" to "fromJSON"
* [nope] Rename Tape to SimpleTape
* history has to store states as well
* possibility to set final states
* [done] exhaustive testing of import & export
* publish solution for 4-bit addition
* possibility to set the cursor in the tape
* [nope] representation of space as 'x'
* [done] reconsider design of reset button

0.8.0 release
~~~~~~~~~~~~~

* tape *always* trims default values
* simplify history in export, but don't break it
* Implementation of history size

1.0.0 release
~~~~~~~~~~~~~

* [nope] Strict decoupling of UI and program through VM commands
* [done] Reconsider design of RecordedTape and history
* [done] Animations instead of state drawings
* [done] Speed option enabled
* Basic interaction with tape
* JFLAP export

1.4.0 release
~~~~~~~~~~~~~

* Instruction graph with springy.js

cheers,
meisterluk
