turingmachine.js
================

:release:   0.9.1-unstable
:date:      October 2013 - Nov 2014
:status:    basic usecases work
:author:    meisterluk
:license:   CC0

A turingmachine for educational purposes.

Installation
------------

Just open ``index.html`` in some modern browser.

Roadmap
-------

0.6.0 release
~~~~~~~~~~~~~

* put dependencies into project repository (done)
* history has to store states as well (done)
* possibility to set final states (done)
* publish solution for 4-bit addition
* possibility to set the cursor in the tape (done)

0.8.0 release
~~~~~~~~~~~~~

* tape *always* trims default values
* simplify history in export, but don't break it (done)
* implementation of history size (done)

1.0.0 release
~~~~~~~~~~~~~

* basic interaction with tape
  clicking on left/right side reveals tape content there
* JFLAP export
* set parameters with hash in GET query (partially)
* easter egg
* Provide "Abort" button besides "disable animation" to actually abort a visualization (as interactive extension of possibly infinite). (done)
* "Set tape content" and "Set final states" should not require the press of a button. Because it is inconsistent with the transition table.
* Provide a button to easily copy the last line of the transition table.

1.4.0 release
~~~~~~~~~~~~~

* instruction graph with springy.js

cheers,
meisterluk
