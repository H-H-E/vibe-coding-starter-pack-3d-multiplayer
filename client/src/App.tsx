/**
 * App.tsx — Entry point for The Flail of Sisyphus.
 *
 * Renders the game directly. No SpacetimeDB multiplayer needed
 * for the initial prototype — the focus is the physics mechanic.
 */

import './App.css';
import { Game } from './Game';

function App() {
  return <Game />;
}

export default App;
