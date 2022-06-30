import noctotion from "../noctotion";

test('Code running', () => {
    expect(noctotion.codeIsRunning).toBe(true);
});