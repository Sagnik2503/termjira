import React, {useState} from 'react';
import {render, Box, Text, useInput, useApp} from 'ink';

const issues = [
  {id: 1, title: 'Fix login bug', status: 'TODO'},
  {id: 2, title: 'Write README', status: 'IN_PROGRESS'},
  {id: 3, title: 'Add sort command', status: 'CLOSED'},
];

function App() {
  const [selected, setSelected] = useState(0); //current value - 0, change on setSelected
  const {exit} = useApp(); //destructuring, taking exit property out of useapp

  useInput((input, key) => {
    if (key.upArrow) setSelected(i => Math.max(0, i - 1));
    if (key.downArrow) setSelected(i => Math.min(issues.length - 1, i + 1));
    if (input === 'q') exit();
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>TermJira</Text>
      {issues.map((issue, index) => (
        <Text key={issue.id} color={index === selected ? 'cyan' : undefined}>
          {index === selected ? '> ' : '  '}#{issue.id} {issue.title} [{issue.status}]
        </Text>
      ))}
      <Text dimColor>↑/↓ move · q quit</Text>
    </Box>
  );
}

render(<App />);