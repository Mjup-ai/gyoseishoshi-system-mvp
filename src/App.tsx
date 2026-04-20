function App() {
  const steps = [
    { id: 1, title: 'Step 1', description: '入力ファイルとマッピングを選択' },
    { id: 2, title: 'Step 2', description: 'ルール評価と警告を確認' },
    { id: 3, title: 'Step 3', description: '変換結果を出力' },
  ];

  return (
    <main>
      <h1>勤務体制変換ツール</h1>
      <ol>
        {steps.map((step) => (
          <li key={step.id}>
            <h2>{step.title}</h2>
            <p>{step.description}</p>
          </li>
        ))}
      </ol>
    </main>
  );
}

export default App;
