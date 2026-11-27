# Third-party notices

TeOrganiza is MIT licensed (see `LICENSE`). It includes the following
third-party material.

## MuscleMap

The body outline and muscle shapes in `src/modules/workouts/body-paths.ts`
are converted from MuscleMap by Melih Colpan
(https://github.com/melihcolpan/MuscleMap). Sub-group shapes were left out;
nothing else was changed.

```
MIT License

Copyright (c) 2026 Melih Colpan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Exercise photos

The start and end photos in `public/exercises/` come from free-exercise-db
by yuhonas (https://github.com/yuhonas/free-exercise-db), published there
under the Unlicense (public domain dedication). The repository does not
state where the photos were first taken; some show a fitness site's logo.
They are kept unchanged, renamed to TeOrganiza's exercise ids, and can be
removed at any time: the app falls back to the muscle map without them.

## Inspiration

Saúde › Treino follows the feature set and the screen flow of openGym
(https://github.com/DuarteSantos8/openGym). No code, text or media from
openGym is included; the implementation and the exercise library were
written for TeOrganiza.
