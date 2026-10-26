import dayjs from 'dayjs';
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Popconfirm,
  Radio,
  Row,
  Space,
  Spin,
  Statistic,
  Tag,
  TimePicker,
  Timeline,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  BarChartOutlined,
  CalendarOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  ExperimentOutlined,
  MoonOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';

const { Title, Text, Paragraph } = Typography;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4002/api';
const DATE_FORMAT = 'YYYY-MM-DD';
const PUMP_SIDE_LABELS = { left: 'Bên trái', right: 'Bên phải', both: 'Cả hai' };

const getLocalDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getCurrentTime = () => new Date().toTimeString().slice(0, 5);

const formatLongDate = (dateString) => new Intl.DateTimeFormat('vi-VN', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
}).format(new Date(`${dateString}T12:00:00`));

const formatShortDate = (dateString) => new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit', month: '2-digit', year: 'numeric',
}).format(new Date(`${dateString}T12:00:00`));

const isToday = (dateString) => dateString === getLocalDate();

const formatDuration = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} phút`;
  return rest ? `${hours} giờ ${rest} phút` : `${hours} giờ`;
};

const groupByDate = (entries, totalKey = 'amountMl') => Object.values(entries.reduce((groups, entry) => {
  groups[entry.date] ||= { date: entry.date, total: 0, count: 0 };
  groups[entry.date].total += Number(entry[totalKey] || 0);
  groups[entry.date].count += 1;
  return groups;
}, {})).sort((a, b) => b.date.localeCompare(a.date));

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || 'Không thể kết nối tới máy chủ.');
  return body;
}

function FeatureDatePicker({ selectedDate, onChange }) {
  return (
    <Card className="date-card feature-date-card" size="small">
      <Text className="field-caption"><CalendarOutlined /> Ngày đang xem</Text>
      <DatePicker value={dayjs(selectedDate)} onChange={(value) => value && onChange(value.format(DATE_FORMAT))} format="DD/MM/YYYY" allowClear={false} size="large" suffixIcon={<CalendarOutlined />} />
    </Card>
  );
}

function FeatureHeading({ eyebrow, title, description, icon, selectedDate, onDateChange }) {
  return (
    <section className="feature-intro">
      <div className="feature-heading-copy">
        <Text className="hero-kicker"><span className="feature-heading-icon">{icon}</span>{eyebrow}</Text>
        <Title>{title}</Title>
        <Paragraph>{description}</Paragraph>
      </div>
      <div className="feature-heading-actions">
        <FeatureDatePicker selectedDate={selectedDate} onChange={onDateChange} />
      </div>
    </section>
  );
}

function PumpTracker({ messageApi, addActionRef }) {
  const today = getLocalDate();
  const [selectedDate, setSelectedDate] = useState(today);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingEntry, setEditingEntry] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ date: today, time: getCurrentTime(), side: 'both', amountMl: '', note: '' });

  const selectedEntries = useMemo(() => entries.filter((entry) => entry.date === selectedDate).sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`)), [entries, selectedDate]);
  const totalMl = selectedEntries.reduce((sum, entry) => sum + entry.amountMl, 0);
  const history = useMemo(() => groupByDate(entries), [entries]);

  const loadEntries = async () => {
    try {
      setLoading(true);
      setEntries(await request('/pump-entries'));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadEntries(); }, []);
  useEffect(() => { setForm((current) => ({ ...current, date: selectedDate })); }, [selectedDate]);

  const updateForm = (patch) => setForm((current) => ({ ...current, ...patch }));
  const resetForm = (date = selectedDate) => {
    setEditingEntry(null);
    setForm({ date, time: getCurrentTime(), side: 'both', amountMl: '', note: '' });
  };
  const openAdd = () => { resetForm(); setError(''); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); resetForm(); };
  if (addActionRef) addActionRef.current = openAdd;

  const handleSubmit = async () => {
    if (!form.date || !form.time || !form.amountMl) return setError('Bạn hãy nhập ngày, giờ và lượng sữa đã hút.');
    try {
      setSaving(true);
      setError('');
      const payload = { ...form, amountMl: Number(form.amountMl) };
      if (editingEntry) {
        const updated = await request(`/pump-entries/${editingEntry.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        setEntries((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
        messageApi.success('Đã cập nhật lần hút sữa.');
      } else {
        const created = await request('/pump-entries', { method: 'POST', body: JSON.stringify(payload) });
        setEntries((current) => [...current, created]);
        messageApi.success('Đã lưu lần hút sữa.');
      }
      setSelectedDate(form.date);
      closeModal();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const beginEdit = (entry) => {
    setEditingEntry(entry);
    setForm({ date: entry.date, time: entry.time, side: entry.side, amountMl: String(entry.amountMl), note: entry.note || '' });
    setModalOpen(true);
  };

  const handleDelete = async (entry) => {
    try {
      await request(`/pump-entries/${entry.id}`, { method: 'DELETE' });
      setEntries((current) => current.filter((item) => item.id !== entry.id));
      messageApi.success('Đã xoá lần hút sữa.');
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  const timelineItems = selectedEntries.map((entry) => ({
    color: '#d49a7e',
    dot: <ExperimentOutlined className="timeline-icon pump-icon" />,
    children: <div className="entry-content"><div className="entry-meta"><Text strong>{entry.time}</Text><Text type="secondary">{PUMP_SIDE_LABELS[entry.side]}</Text></div><div className="entry-main"><div><Text className="entry-amount">{entry.amountMl} <small>ml</small></Text>{entry.note && <Paragraph className="entry-note">{entry.note}</Paragraph>}</div><Space size={2} className="entry-actions"><Tooltip title="Chỉnh sửa"><Button type="text" shape="circle" icon={<EditOutlined />} onClick={() => beginEdit(entry)} /></Tooltip><Popconfirm title="Xoá lần hút này?" okText="Xoá" cancelText="Huỷ" okButtonProps={{ danger: true }} onConfirm={() => handleDelete(entry)}><Tooltip title="Xoá"><Button type="text" danger shape="circle" icon={<DeleteOutlined />} /></Tooltip></Popconfirm></Space></div></div>,
  }));

  const pumpForm = <Form layout="vertical" requiredMark={false} onFinish={handleSubmit}>
    <Form.Item label="Ngày hút"><DatePicker value={dayjs(form.date)} onChange={(value) => value && updateForm({ date: value.format(DATE_FORMAT) })} format="DD/MM/YYYY" allowClear={false} size="large" style={{ width: '100%' }} /></Form.Item>
    <Row gutter={10}><Col span={10}><Form.Item label="Giờ hút"><TimePicker value={dayjs(`2000-01-01T${form.time}`)} onChange={(value) => value && updateForm({ time: value.format('HH:mm') })} format="HH:mm" minuteStep={5} allowClear={false} size="large" style={{ width: '100%' }} /></Form.Item></Col><Col span={14}><Form.Item label="Lượng sữa (ml)"><InputNumber min={1} max={3000} step={10} placeholder="Ví dụ 120" value={form.amountMl ? Number(form.amountMl) : null} onChange={(value) => updateForm({ amountMl: value ?? '' })} size="large" style={{ width: '100%' }} /></Form.Item></Col></Row>
    <Form.Item label="Bên hút"><Radio.Group optionType="button" buttonStyle="solid" value={form.side} onChange={(event) => updateForm({ side: event.target.value })} options={[{ label: 'Bên trái', value: 'left' }, { label: 'Bên phải', value: 'right' }, { label: 'Cả hai', value: 'both' }]} /></Form.Item>
    <Form.Item label="Ghi chú"><Input.TextArea rows={3} maxLength={160} showCount placeholder="Ví dụ: Hút sau khi bé bú..." value={form.note} onChange={(event) => updateForm({ note: event.target.value })} /></Form.Item>
    <Button type="primary" htmlType="submit" size="large" block icon={editingEntry ? <CheckOutlined /> : <PlusOutlined />} loading={saving}>{editingEntry ? 'Lưu thay đổi' : 'Lưu lần hút sữa'}</Button>
  </Form>;

  return <div className="feature-view">
    <FeatureHeading eyebrow="NHẬT KÝ CỦA MẸ" title="Mẹ hút sữa" description="Theo dõi lượng sữa mẹ hút mỗi ngày để nhìn lại nhịp chăm sóc của cả nhà." icon={<ExperimentOutlined />} selectedDate={selectedDate} onDateChange={setSelectedDate} />
    {error && <Alert className="page-alert" type="error" showIcon message={error} closable onClose={() => setError('')} />}
    <Row gutter={[18, 18]}>
      <Col xs={24} sm={9}><Card className="feature-summary-card card-surface"><Text className="eyebrow">TỔNG HÔM NAY</Text><Statistic value={totalMl} suffix="ml" /><div className="summary-foot"><Tag color="orange">{selectedEntries.length} lần hút</Tag><Text type="secondary">{selectedEntries.length ? Math.round(totalMl / selectedEntries.length) : 0} ml / lần</Text></div></Card></Col>
      <Col xs={24} sm={15}><Card className="journal-card card-surface feature-log-card" title={<div className="history-title"><div><Text className="eyebrow">DÒNG THỜI GIAN</Text><Title level={3}>{isToday(selectedDate) ? 'Hôm nay' : formatLongDate(selectedDate)}</Title></div><Button type="primary" shape="circle" icon={<PlusOutlined />} onClick={openAdd} aria-label="Thêm lần hút sữa" /></div>}>{loading ? <div className="state-box"><Spin tip="Đang tải lịch sử..." /></div> : selectedEntries.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có lần hút sữa nào trong ngày này." /> : <Timeline className="entry-timeline" items={timelineItems} />}</Card></Col>
    </Row>
    <Card className="history-card card-surface feature-history-card" title={<div className="history-title"><div><Text className="eyebrow">NHÌN LẠI</Text><Title level={3}>Lịch sử hút sữa</Title></div><BarChartOutlined /></div>}>{history.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Lịch sử sẽ xuất hiện sau khi lưu lần hút đầu tiên." /> : <List dataSource={history.slice(0, 8)} split={false} renderItem={(day) => <List.Item className="history-list-item"><Button type="text" block className={`history-day ${day.date === selectedDate ? 'active' : ''}`} onClick={() => setSelectedDate(day.date)}><span className="history-calendar"><strong>{new Date(`${day.date}T12:00:00`).getDate()}</strong><small>{new Intl.DateTimeFormat('vi-VN', { month: 'short' }).format(new Date(`${day.date}T12:00:00`))}</small></span><span className="history-info"><strong>{isToday(day.date) ? 'Hôm nay' : formatShortDate(day.date)}</strong><small>{day.count} lần hút</small></span><strong className="history-total">{day.total}<small> ml</small></strong></Button></List.Item>} />}</Card>
    <Modal className="milk-modal" open={modalOpen} centered width={520} footer={null} onCancel={closeModal} title={<div><Text className="eyebrow">{editingEntry ? 'CHỈNH SỬA' : 'GHI NHẬN MỚI'}</Text><Title level={3}>{editingEntry ? 'Cập nhật lần hút' : 'Thêm lần hút sữa'}</Title></div>}>{pumpForm}</Modal>
  </div>;
}

function SleepTracker({ messageApi, addActionRef }) {
  const today = getLocalDate();
  const [selectedDate, setSelectedDate] = useState(today);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingEntry, setEditingEntry] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ date: today, startTime: '', endTime: '', note: '' });

  const selectedEntries = useMemo(() => entries.filter((entry) => entry.date === selectedDate).sort((a, b) => a.startTime.localeCompare(b.startTime)), [entries, selectedDate]);
  const totalMinutes = selectedEntries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const history = useMemo(() => groupByDate(entries, 'durationMinutes'), [entries]);

  const loadEntries = async () => {
    try {
      setLoading(true);
      setEntries(await request('/sleep-entries'));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadEntries(); }, []);
  useEffect(() => { setForm((current) => ({ ...current, date: selectedDate })); }, [selectedDate]);

  const updateForm = (patch) => setForm((current) => ({ ...current, ...patch }));
  const resetForm = (date = selectedDate) => { setEditingEntry(null); setForm({ date, startTime: '', endTime: '', note: '' }); };
  const openAdd = () => { resetForm(); setError(''); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); resetForm(); };
  if (addActionRef) addActionRef.current = openAdd;

  const handleSubmit = async () => {
    if (!form.date || !form.startTime || !form.endTime) return setError('Bạn hãy nhập ngày, giờ bắt đầu và giờ kết thúc.');
    if (form.startTime === form.endTime) return setError('Giờ bắt đầu và kết thúc không được giống nhau.');
    try {
      setSaving(true);
      setError('');
      const payload = { ...form };
      if (editingEntry) {
        const updated = await request(`/sleep-entries/${editingEntry.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        setEntries((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
        messageApi.success('Đã cập nhật giấc ngủ.');
      } else {
        const created = await request('/sleep-entries', { method: 'POST', body: JSON.stringify(payload) });
        setEntries((current) => [...current, created]);
        messageApi.success('Đã lưu giấc ngủ.');
      }
      setSelectedDate(form.date);
      closeModal();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const beginEdit = (entry) => {
    setEditingEntry(entry);
    setForm({ date: entry.date, startTime: entry.startTime, endTime: entry.endTime, note: entry.note || '' });
    setModalOpen(true);
  };

  const handleDelete = async (entry) => {
    try {
      await request(`/sleep-entries/${entry.id}`, { method: 'DELETE' });
      setEntries((current) => current.filter((item) => item.id !== entry.id));
      messageApi.success('Đã xoá giấc ngủ.');
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  const timelineItems = selectedEntries.map((entry) => ({
    color: '#8faec7',
    dot: <MoonOutlined className="timeline-icon sleep-icon" />,
    children: <div className="entry-content"><div className="entry-meta"><Text strong>{entry.startTime} – {entry.endTime}</Text><Text type="secondary">{formatDuration(entry.durationMinutes)}</Text></div><div className="entry-main"><div>{entry.note && <Paragraph className="entry-note sleep-note">{entry.note}</Paragraph>}</div><Space size={2} className="entry-actions"><Tooltip title="Chỉnh sửa"><Button type="text" shape="circle" icon={<EditOutlined />} onClick={() => beginEdit(entry)} /></Tooltip><Popconfirm title="Xoá giấc ngủ này?" okText="Xoá" cancelText="Huỷ" okButtonProps={{ danger: true }} onConfirm={() => handleDelete(entry)}><Tooltip title="Xoá"><Button type="text" danger shape="circle" icon={<DeleteOutlined />} /></Tooltip></Popconfirm></Space></div></div>,
  }));

  const sleepForm = <Form layout="vertical" requiredMark={false} onFinish={handleSubmit}>
    <Form.Item label="Ngày ngủ"><DatePicker value={dayjs(form.date)} onChange={(value) => value && updateForm({ date: value.format(DATE_FORMAT) })} format="DD/MM/YYYY" allowClear={false} size="large" style={{ width: '100%' }} /></Form.Item>
    <Row gutter={10}><Col span={12}><Form.Item label="Bắt đầu"><TimePicker value={form.startTime ? dayjs(`2000-01-01T${form.startTime}`) : null} onChange={(value) => value && updateForm({ startTime: value.format('HH:mm') })} format="HH:mm" minuteStep={5} allowClear={false} size="large" style={{ width: '100%' }} /></Form.Item></Col><Col span={12}><Form.Item label="Kết thúc"><TimePicker value={form.endTime ? dayjs(`2000-01-01T${form.endTime}`) : null} onChange={(value) => value && updateForm({ endTime: value.format('HH:mm') })} format="HH:mm" minuteStep={5} allowClear={false} size="large" style={{ width: '100%' }} /></Form.Item></Col></Row>
    <Form.Item label="Ghi chú"><Input.TextArea rows={3} maxLength={160} showCount placeholder="Ví dụ: Ngủ ngon, không quấy..." value={form.note} onChange={(event) => updateForm({ note: event.target.value })} /></Form.Item>
    <Button type="primary" htmlType="submit" size="large" block icon={editingEntry ? <CheckOutlined /> : <PlusOutlined />} loading={saving}>{editingEntry ? 'Lưu thay đổi' : 'Lưu giấc ngủ'}</Button>
  </Form>;

  return <div className="feature-view sleep-view">
    <FeatureHeading eyebrow="NHỊP NGHỈ NGƠI" title="Giấc ngủ của con" description="Ghi lại những giấc ngủ ngắn và dài để hiểu hơn nhịp nghỉ ngơi của bé Mía." icon={<MoonOutlined />} selectedDate={selectedDate} onDateChange={setSelectedDate} />
    {error && <Alert className="page-alert" type="error" showIcon message={error} closable onClose={() => setError('')} />}
    <Row gutter={[18, 18]}>
      <Col xs={24} sm={9}><Card className="feature-summary-card sleep-summary-card card-surface"><Text className="eyebrow">TỔNG NGỦ HÔM NAY</Text><Statistic value={formatDuration(totalMinutes)} /><div className="summary-foot"><Tag color="blue">{selectedEntries.length} giấc ngủ</Tag><Text type="secondary">Nhật ký nghỉ ngơi</Text></div></Card></Col>
      <Col xs={24} sm={15}><Card className="journal-card card-surface feature-log-card" title={<div className="history-title"><div><Text className="eyebrow">DÒNG THỜI GIAN</Text><Title level={3}>{isToday(selectedDate) ? 'Hôm nay' : formatLongDate(selectedDate)}</Title></div><Button type="primary" shape="circle" icon={<PlusOutlined />} onClick={openAdd} aria-label="Thêm giấc ngủ" /></div>}>{loading ? <div className="state-box"><Spin tip="Đang tải lịch sử..." /></div> : selectedEntries.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có giấc ngủ nào trong ngày này." /> : <Timeline className="entry-timeline" items={timelineItems} />}</Card></Col>
    </Row>
    <Card className="history-card card-surface feature-history-card" title={<div className="history-title"><div><Text className="eyebrow">NHÌN LẠI</Text><Title level={3}>Lịch sử giấc ngủ</Title></div><BarChartOutlined /></div>}>{history.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Lịch sử sẽ xuất hiện sau khi lưu giấc ngủ đầu tiên." /> : <List dataSource={history.slice(0, 8)} split={false} renderItem={(day) => <List.Item className="history-list-item"><Button type="text" block className={`history-day ${day.date === selectedDate ? 'active' : ''}`} onClick={() => setSelectedDate(day.date)}><span className="history-calendar sleep-history-calendar"><strong>{new Date(`${day.date}T12:00:00`).getDate()}</strong><small>{new Intl.DateTimeFormat('vi-VN', { month: 'short' }).format(new Date(`${day.date}T12:00:00`))}</small></span><span className="history-info"><strong>{isToday(day.date) ? 'Hôm nay' : formatShortDate(day.date)}</strong><small>{day.count} giấc ngủ</small></span><strong className="history-total">{formatDuration(day.total)}</strong></Button></List.Item>} />}</Card>
    <Modal className="milk-modal" open={modalOpen} centered width={520} footer={null} onCancel={closeModal} title={<div><Text className="eyebrow">{editingEntry ? 'CHỈNH SỬA' : 'GHI NHẬN MỚI'}</Text><Title level={3}>{editingEntry ? 'Cập nhật giấc ngủ' : 'Thêm giấc ngủ'}</Title></div>}>{sleepForm}</Modal>
  </div>;
}

export { PumpTracker, SleepTracker };
