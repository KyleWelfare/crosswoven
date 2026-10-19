# Crosswoven

A logic puzzle in the browser. Lay coloured threads between pegs so the woven cloth matches a pattern. Where two threads cross, their colours mix, and the finished cloth is a pixel-art picture.

Every puzzle is generated from a picture and certified by a validator: exactly one solution, reachable by deduction alone.

Work in progress. See [docs/DESIGN.md](docs/DESIGN.md).

## Development

```sh
npm install
npm run dev      # local dev server
npm run check    # lint, typecheck, tests
npm run build    # production build in dist/
```
