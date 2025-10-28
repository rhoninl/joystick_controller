import { useState, useEffect, useCallback } from 'react';

export interface GamepadState {
  buttons: boolean[];
  axes: number[];
  timestamp: number;
}

export const useGamepad = () => {
  const [gamepads, setGamepads] = useState<Gamepad[]>([]);
  const [selectedGamepadIndex, setSelectedGamepadIndex] = useState<number | null>(null);
  const [gamepadState, setGamepadState] = useState<GamepadState | null>(null);

  const updateGamepads = useCallback(() => {
    const connectedGamepads = navigator.getGamepads();
    const validGamepads = Array.from(connectedGamepads).filter(
      (gp): gp is Gamepad => gp !== null
    );
    setGamepads(validGamepads);
  }, []);

  useEffect(() => {
    const handleGamepadConnected = (e: GamepadEvent) => {
      console.log('Gamepad connected:', e.gamepad.id);
      updateGamepads();
    };

    const handleGamepadDisconnected = (e: GamepadEvent) => {
      console.log('Gamepad disconnected:', e.gamepad.id);
      updateGamepads();
      if (selectedGamepadIndex === e.gamepad.index) {
        setSelectedGamepadIndex(null);
      }
    };

    window.addEventListener('gamepadconnected', handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);

    // Initial check for already connected gamepads
    updateGamepads();

    return () => {
      window.removeEventListener('gamepadconnected', handleGamepadConnected);
      window.removeEventListener('gamepaddisconnected', handleGamepadDisconnected);
    };
  }, [updateGamepads, selectedGamepadIndex]);

  useEffect(() => {
    if (selectedGamepadIndex === null) {
      setGamepadState(null);
      return;
    }

    let animationFrameId: number;

    const pollGamepad = () => {
      const gamepadList = navigator.getGamepads();
      const gamepad = gamepadList[selectedGamepadIndex];

      if (gamepad) {
        setGamepadState({
          buttons: Array.from(gamepad.buttons).map(b => b.pressed),
          axes: Array.from(gamepad.axes),
          timestamp: gamepad.timestamp,
        });
      }

      animationFrameId = requestAnimationFrame(pollGamepad);
    };

    pollGamepad();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [selectedGamepadIndex]);

  return {
    gamepads,
    selectedGamepadIndex,
    setSelectedGamepadIndex,
    gamepadState,
  };
};
