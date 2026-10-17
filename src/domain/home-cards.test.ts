import { DEFAULT_HOME_CARDS, HOME_CARDS, moveCard, parseHomeCards, toggleCard } from './home-cards';

describe('tarjetas del Inicio', () => {
  it('sin guardar o con JSON roto: todas, visibles, en el orden de siempre', () => {
    expect(parseHomeCards(undefined)).toEqual(DEFAULT_HOME_CARDS);
    expect(parseHomeCards('no es json')).toEqual(DEFAULT_HOME_CARDS);
    expect(parseHomeCards('{"id":"recent"}')).toEqual(DEFAULT_HOME_CARDS);
  });

  it('respeta orden y visibilidad; descarta desconocidas y repetidas; agrega las que falten al final', () => {
    const cards = parseHomeCards(
      JSON.stringify([{ id: 'recent', visible: false }, { id: 'saldo' }, { id: 'recent', visible: true }, null, { id: 'income' }]),
    );
    expect(cards.slice(0, 2)).toEqual([{ id: 'recent', visible: false }, { id: 'income', visible: true }]);
    expect(cards.map((c) => c.id).sort()).toEqual([...HOME_CARDS].sort());
    expect(cards.slice(2).every((c) => c.visible)).toBe(true);
  });

  it('subir, bajar y ocultar', () => {
    const up = moveCard(DEFAULT_HOME_CARDS, 'budgets', -1);
    expect(up.map((c) => c.id).slice(0, 2)).toEqual(['budgets', 'store']);
    expect(moveCard(DEFAULT_HOME_CARDS, 'store', -1)).toEqual(DEFAULT_HOME_CARDS); // ya es la primera
    expect(moveCard(DEFAULT_HOME_CARDS, 'recent', 1)).toEqual(DEFAULT_HOME_CARDS); // ya es la última
    expect(toggleCard(DEFAULT_HOME_CARDS, 'income').find((c) => c.id === 'income')?.visible).toBe(false);
    expect(parseHomeCards(JSON.stringify(toggleCard(up, 'accounts')))).toEqual(toggleCard(up, 'accounts')); // ida y vuelta
  });
});
